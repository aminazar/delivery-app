import {Component, OnInit} from '@angular/core';
import {NavController, ToastController, LoadingController, AlertController} from 'ionic-angular';
import {HttpService} from '../../services/http.service';
import {DeliveryDetailsPage} from '../delivery-details/delivery-details';
import * as moment from 'moment';
import {AuthService} from '../../services/auth.service';
import {LOGIN_TYPE} from '../../lib/login_type.enum';
import {WarehouseService} from '../../services/warehoues.service';
import {DELIVERY_STATUS} from '../../lib/delivery_status.enum';
import {OrderDetailsPage} from '../order-details/order-details';

@Component({
  selector: 'page-internal-inbox',
  templateUrl: 'internal-inbox.html',
})
export class InternalInboxPage implements OnInit {
  deliveryItems = [];
  Full = true;

  constructor(public navCtrl: NavController, private httpService: HttpService,
    private toastCtrl: ToastController, private loadingCtrl: LoadingController,
    private authService: AuthService, private warehouseService: WarehouseService,
    private alertCtrl: AlertController) {
  }

  ngOnInit() {
  }

  ionViewDidEnter() {
    this.load();
  }

  ionViewDidLeave() {
  }

  load() {
    const loading = this.loadingCtrl.create({
      content: 'در حال دریافت لیست ارسال ها. لطفا صبر کنید ...'
    });

    loading.present();

    this.httpService.post('search/DeliveryTicket', {
      offset: 0,
      limit: 100,
      options: {
        type: "InternalAssignedDelivery",
        Full:  this.Full
      }
    }).subscribe(
      res => {
        console.log('res:', res);
        this.deliveryItems = res.data;

        loading.dismiss();
      },
      err => {
        console.error('Cannot fetch delivery items as inbox: ', err);
        loading.dismiss();
        this.toastCtrl.create({
          message: 'قادر به دریافت لیست ورودی های شما نیستیم. دوباره تلاش کنید',
          duration: 3200,
        }).present();
      });
  }

  selectDelivery(item) {

    this.navCtrl.push(DeliveryDetailsPage, {
      delivery: item,
      is_delivered: false,
    });
  }

  showOrderLineDetails(item) {
    this.navCtrl.push(OrderDetailsPage, {
      delivery: item,
      is_delivered: false,
    });

  }

  getDistrict(item) {
    return item.to.warehouse_id ? this.warehouseService.getWarehouse(item.to.warehouse_id).address.district : '-';

  }

  getStreet(item) {

    return item.to.warehouse_id ? this.warehouseService.getWarehouse(item.to.warehouse_id).address.street : '-';
  }

  getReceiverName(item) {
    let receiver;
    return item.to.warehouse_id ? this.warehouseService.getWarehouse(item.to.warehouse_id).name : '-';
  }

  getStartDate(item) {
    return moment(item.start).format('YYYY-MM-DD');
  }

  getDeliveryType(item) {
    if (item.from.customer && item.form.customer._id)
      return 'بازگشت';
    else if (item.to.customer && item.to.customer._id)
      return 'ارسال به مشتری';
    else if (item.to.warehouse_id)
      return 'داخلی'
  }

  
  isDeliveryOrdersRequested(item) {
    return item.last_ticket.status === DELIVERY_STATUS.requestPackage;
  }

  requestDeliveryOrders() {
    if (!this.deliveryItems.length)
      return;

    const loading = this.loadingCtrl.create({
        content: 'در حال اعمال تغیرات. لطفا صبر کنید ...'
      });
      loading.present();

    this.httpService.post('delivery/requestPackage', {
      deliveryId: this.deliveryItems[0]._id,
    }).subscribe(
      data => {
        loading.dismiss();
        this.toastCtrl.create({
          message: 'درخواست تحویل بسته با موفقیت انجام شد',
          duration: 2300,
        }).present();
        this.load();
      },
      err => {
        console.error('Cannot request for delivery orders: ', err.error);

        let message = err.error = 'selected agent has incomplete delivery' ?
          'ارسال در حال اجرا هنوز پایان نیافته است' :
          'خطا در درخواست بسته ارسالی. دوباره تلاش کنید'

        this.toastCtrl.create({
          message,
          duration: 3200,
        }).present();
        loading.dismiss();
      });
  }


  unassignDelivery() {
    if (!this.deliveryItems.length) {
      return;
    }

    const loading = this.loadingCtrl.create({
      content: 'در حال اعمال تغیرات. لطفا صبر کنید ...'
    });

    loading.present();

    this.httpService.post('delivery/unassign', {
      deliveryId: this.deliveryItems[0]._id
    }).subscribe(
      data => {
        loading.dismiss();
        this.toastCtrl.create({
          message: 'ارسال با موفقت از لیست شما حذف شد',
          duration: 2000,
        }).present();
        this.load();
      },
      err => {
        console.error('Error when unassign delivery from current agent: ', err);
        loading.dismiss();
        this.toastCtrl.create({
          message: 'خطا به هنگام حذف ارسال از لیست. دوباره تلاش کنید',
          duration: 2000,
        }).present();
      });
  }

  startDelivery(item) {

    const loading = this.loadingCtrl.create({
      content: 'در حال بررسی موارد اسکن شده. لطفا صبر کنید ...'
    });

    loading.present();

    this.httpService.post('delivery/start', {
      deliveryId: item._id,
      preCheck: true
    }).subscribe(res => {


      loading.dismiss();
      if (!res || !res.length) {
        this.toastCtrl.create({
          message: 'هیچ یک از محصولات اسکن نشده است',
          duration: 2000,
        }).present();
        return;
      }

      let message;

      let totalDeliveryOrderLines = [];
      this.deliveryItems[0].order_details.forEach(x => {
        totalDeliveryOrderLines = totalDeliveryOrderLines.concat(x.order_lines.map(x => x._id));
      })

      res = res.map(x => x.order_line_id);
      if (res.length === totalDeliveryOrderLines.length && res.every(x => totalDeliveryOrderLines.includes(x)))
        message = 'everything is OK. start scan?'
      else {
        message = `${res.length} of ${totalDeliveryOrderLines.length} is ready. start scan?`
      }
      let alert = this.alertCtrl.create({
        title: 'شروع ارسال',
        message,
        buttons: [
          {
            text: 'خیر',
            role: 'cancel',
            handler: () => {
            }
          },
          {
            text: 'بله',
            handler: () => {
              const loading = this.loadingCtrl.create({
                content: 'در حال شروع ارسال. لطفا صبر کنید ...'
              });
              loading.present();

              this.httpService.post('delivery/start', {
                deliveryId: item._id,
              }).subscribe(res => {
                loading.dismiss();
                this.load();
              }, err => {
                console.error('Error on start delivery ', err);
                loading.dismiss();
                this.toastCtrl.create({
                  message: 'خطا به هنگام شروع ارسال. دوباره تلاش کنید',
                  duration: 2000,
                }).present();
              });
            }
          }
        ]
      });
      alert.present();
    }, err => {
      console.error('Error on pre check order line before delivery started ', err);
      loading.dismiss();
      this.toastCtrl.create({
        message: 'خطا به هنگام بررسی موارد اسکن شده. دوباره تلاش کنید',
        duration: 2000,
      }).present();
    })



  }
}