"use strict";

var ObjectId = require("mongodb").ObjectId;
require("mongodb-toolkit");
var DLModels = require("dl-models");
var map = DLModels.map;
var Customs = DLModels.garmentPurchasing.Customs;
var BaseManager = require("module-toolkit").BaseManager;
var SupplierManager = require("../master/garment-supplier-manager");
var CurrencyManager = require("../master/currency-manager");
var DeliveryOrderManager = require("./delivery-order-manager");
var i18n = require("dl-i18n");
var moment = require('moment');

module.exports = class CustomsManager extends BaseManager {
    constructor(db, user) {
        super(db, user);
        this.year = (new Date()).getFullYear().toString().substring(2, 4);
        this.collection = this.db.use(map.garmentPurchasing.collection.Customs);
        this.supplierManager = new SupplierManager(db, user);
        this.currencyManager = new CurrencyManager(db, user);
        this.deliveryOrderManager = new DeliveryOrderManager(db, user);
    }

    _getQuery(paging) {

        var _default = {
            _deleted: false
        },
            pagingFilter = paging.filter || {},
            keywordFilter = {},
            query = {};

        if (paging.keyword) {
            var regex = new RegExp(paging.keyword, "i");
            var filterNo = {
                "no": {
                    "$regex": regex
                }
            };

            var filterSupplier = {
                "supplier.name": {
                    "$regex": regex
                }
            };

            var filterDeliveryOrder = {
                "deliveryOrders" : {
                    "$elemMatch": {
                        "no" : {
                            "$regex": regex
                        }
                    }
                }
            };

            var filterCustomsType = {
                "customsType": {
                    "$regex": regex
                }
            };

            var filterCustomsOrigin = {
                "customsOrigin": {
                    "$regex": regex
                }
            };
            keywordFilter['$or'] = [filterNo, filterSupplier, filterDeliveryOrder, filterCustomsType, filterCustomsOrigin];
        }
        query["$and"] = [_default, keywordFilter, pagingFilter];
        return query;
    }

    _validate(customs) {
        var errors = {};
        var valid = customs;
        return new Promise((resolve, reject) => {
            var dateNow = new Date();
            var getCustoms = this.collection.singleOrDefault({
                _id: {
                    '$ne': valid._id ? new ObjectId(valid._id) : ""
                },
                no: valid.no ? valid.no : "",
                customsDate : valid.customsDate && valid.customsDate !== "" ? (new Date(valid.customsDate)) : (new Date("1900-01-01")),
                validateDate : valid.validateDate && valid.validateDate !== "" ? (new Date(valid.validateDate)) : (new Date("1900-01-01")),
                supplierId : valid.supplierId && ObjectId.isValid(valid.supplierId) ? (new ObjectId(valid.supplierId)) : '',
                _deleted : false
            });
            var getSupplier = valid.supplierId && ObjectId.isValid(valid.supplierId) ? this.supplierManager.getSingleByIdOrDefault(new ObjectId(valid.supplierId)) : Promise.resolve(null);
            var getCurrency = valid.currencyId && ObjectId.isValid(valid.currencyId) ? this.currencyManager.getSingleByIdOrDefault(new ObjectId(valid.currencyId)) : Promise.resolve(null);
            var getDeliveryOrders = []
            if(valid && valid.deliveryOrders){
                for(var item of valid.deliveryOrders){
                    var deliveryOrder = Promise.resolve(null);
                    if(item){
                        deliveryOrder = ObjectId.isValid(item._id) ? this.deliveryOrderManager.getSingleByIdOrDefault(new ObjectId(item._id)) : Promise.resolve(null);
                    }
                    getDeliveryOrders.push(deliveryOrder);
                }
            }
            Promise.all([getCustoms, getSupplier, getCurrency].concat(getDeliveryOrders))
                .then(results=>{
                    var _customs = results[0];
                    var _supplier = results[1];
                    var _currency = results[2];
                    var _item = results.slice(3, results.length);

                    if(!valid.no || valid.no === "")
                        errors["no"] = i18n.__("Harus diisi", i18n.__("Customs.no._:No")); //nomor Beacukai harus diisi
                    else if(_customs)
                        errors["no"] = i18n.__("No Beacukai dengan supplier, tanggal beacukai dan tanggal validasi yang sama sudah ada", i18n.__("Customs.no._:No"));

                    if(!valid.customsDate || valid.customsDate === "")
                        errors["customsDate"] = i18n.__("Harus diisi", i18n.__("Customs.customsDate._:CustomsDate")); //tanggal Beacukai harus diisi
                    else{
                        var customsDate = new Date(valid.customsDate);
                        if(customsDate > dateNow)
                            errors["customsDate"] = i18n.__("Tidak boleh lebih dari tanggal hari ini", i18n.__("Customs.customsDate._:CustomsDate")); //tanggal Beacukai tidak boleh lebih dari tanggal hari ini
                    }

                    if(!valid.packaging || valid.packaging === "")
                        errors["packaging"] = i18n.__("Harus diisi", i18n.__("Customs.packaging._:Packaging"));

                    if(!valid.amountOfPackaging || valid.amountOfPackaging === "" || valid.amountOfPackaging < 1)
                        errors["amountOfPackaging"] = i18n.__("Harus diisi lebih dari 0", i18n.__("Customs.amountOfPackaging._:AmountOfPackaging"));

                    if(!valid.bruto || valid.bruto === "" || valid.bruto < 1)
                        errors["bruto"] = i18n.__("Harus diisi lebih dari 0", i18n.__("Customs.bruto._:Bruto"));

                    if(!valid.netto || valid.netto === "" || valid.netto < 1)
                        errors["netto"] = i18n.__("Harus diisi lebih dari 0", i18n.__("Customs.netto._:Netto"));
                    else{
                        if(valid.bruto && valid.bruto !== "" && valid.bruto < valid.netto)
                            errors["netto"] = i18n.__("Harus kurang dari atau sama dengan nilai bruto", i18n.__("Customs.netto._:Netto"));
                    }

                    if(!valid.customsType || valid.customsType === "")
                        errors["customsType"] = i18n.__("Harus diisi", i18n.__("Customs.customsType._:CustomsType")); //tanggal Beacukai harus diisi

                    if(!valid.validateDate || valid.validateDate === "")
                        errors["validateDate"] = i18n.__("Harus diisi", i18n.__("Customs.validateDate._:ValidateDate")); //tanggal Beacukai harus diisi
                    else{
                        var validateDate = new Date(valid.validateDate);
                        if(validateDate > dateNow)
                            errors["validateDate"] = i18n.__("Tidak boleh lebih dari tanggal hari ini", i18n.__("Customs.validateDate._:ValidateDate")); //tanggal validasi tidak boleh lebih dari tanggal hari ini
                        if(valid.customsDate){
                            var customsDate = new Date(valid.customsDate);
                            if(validateDate<customsDate)
                                errors["validateDate"] = i18n.__("Tidak boleh kurang dari tanggal Bea Cukai", i18n.__("Customs.validateDate._:ValidateDate")); //tanggal validasi tidak boleh kurang dari tanggal Bea Cukai
                        }
                    }

                    if(!valid.supplierId || valid.supplierId === "")
                        errors["supplier"] = i18n.__("Harus diisi", i18n.__("Customs.supplier._:Supplier")); //supplier harus diisi
                    if(!_supplier)
                        errors["supplier"] = i18n.__("Data Supplier tidak ditemukan", i18n.__("Customs.supplier._:Supplier")); //supplier harus diisi

                    if(!valid.currencyId || valid.currencyId === "")
                        errors["currency"] = i18n.__("Harus diisi", i18n.__("Customs.currency._:Currency")); //currency harus diisi
                    if(!_currency)
                        errors["currency"] = i18n.__("Data mata uang tidak ditemukan", i18n.__("Customs.currency._:Currency")); //currency harus diisi
                    
                    if(!valid.deliveryOrders || (valid.deliveryOrder && valid.deliveryOrder.length <= 0))
                        errors["deliveryOrders"] = i18n.__("Surat Jalan harus dipilih minimal 1", i18n.__("Customs.deliveryOrders._:DeliveryOrders")); //Surat Jalan harus dipilih
                    else{
                        if(_supplier){
                            var itemErrors = [];
                            for(var item of valid.deliveryOrders){
                                var itemError = {};
                                if(item){
                                    function searchItem(params) {
                                        return !params || params === "" ? null : params.no === item.no && params.supplier.code === _supplier.code;
                                    }
                                    var dOrder = _item.find(searchItem)
                                    if(!dOrder){
                                        itemError["no"] = i18n.__("Surat Jalan tidak ditemukan", i18n.__("Customs.deliveryOrders.no._:No")); //Surat Jalan harus dipilih
                                        itemError["dOrderNumber"] = i18n.__(`${item.no}`, i18n.__("Customs.deliveryOrders.dOrderNumber._:DOrderNumber"));
                                    }
                                }
                                itemErrors.push(itemError);
                            }
                            for (var itemError of itemErrors) {
                                if (Object.getOwnPropertyNames(itemError).length > 0) {
                                    errors.deliveryOrders = itemErrors;
                                    break;
                                }
                            }
                        }
                    }

                    if (Object.getOwnPropertyNames(errors).length > 0) {
                        var ValidationError = require("module-toolkit").ValidationError;
                        return Promise.reject(new ValidationError("data does not pass validation", errors));
                    }

                    if(_supplier){
                        valid.supplierId = _supplier._id;
                        valid.supplier = _supplier;
                    }
                    if(_currency){
                        valid.currencyId = _currency._id;
                        valid.currency = _currency;
                    }

                    valid.customsDate = new Date(valid.customsDate);
                    valid.validateDate = new Date(valid.validateDate);
                    valid.deliveryOrders = _item;
                    if (!valid.stamp)
                        valid = new Customs(valid);
                    valid.stamp(this.user.username, "manager");
                    resolve(valid);
                })
                .catch(e => {
                    reject(e);
                })
        });
    }

    _beforeInsert(data) {
        data._createdDate = new Date();
        return Promise.resolve(data);
    }
    
    _afterInsert(id) {
        return new Promise((resolve, reject) => {
            this.collection.singleOrDefault({"_id" : new ObjectId(id)})
                .then(customs => {
                    var updateDeliveryOrder = [];
                    for(var data of customs.deliveryOrders){
                        data.customsId = customs._id;
                        data.customsNo = customs.no;
                        data.hasCustoms = true;
                        updateDeliveryOrder.push(this.deliveryOrderManager.update(data));
                    }
                    Promise.all(updateDeliveryOrder)
                        .then(data => {
                            resolve(id);
                        })
                        .catch(e => {
                            reject(e);
                        })
                })
                .catch(e => {
                    reject(e);
                })
        });
    }
    
    _beforeUpdate(data) {
        return new Promise((resolve, reject) => {
            this.collection.singleOrDefault({"_id" : new ObjectId(data._id)})
                .then(customs => {
                    var updateDeliveryOrder = [];
                    for(var dOrder of customs.deliveryOrders){
                        delete dOrder.customsId;
                        delete dOrder.customsNo;
                        dOrder.hasCustoms = false;
                        updateDeliveryOrder.push(this.deliveryOrderManager.update(dOrder));
                    }
                    Promise.all(updateDeliveryOrder)
                        .then(id => {
                            resolve(data);
                        })
                        .catch(e => {
                            reject(e);
                        })
                })
                .catch(e => {
                    reject(e);
                })
        });
    }
    
    _afterUpdate(id) {
        return new Promise((resolve, reject) => {
            this.collection.singleOrDefault({"_id" : new ObjectId(id)})
                .then(customs => {
                    var updateDeliveryOrder = [];
                    for(var data of customs.deliveryOrders){
                        data.customsId = customs._id;
                        data.customsNo = customs.no;
                        data.hasCustoms = true;
                        updateDeliveryOrder.push(this.deliveryOrderManager.update(data));
                    }
                    Promise.all(updateDeliveryOrder)
                        .then(data => {
                            resolve(id);
                        })
                        .catch(e => {
                            reject(e);
                        })
                })
                .catch(e => {
                    reject(e);
                })
        });
    }

    delete(data) {
        return new Promise((resolve, reject) => {
            this.collection.singleOrDefault({"_id" : new ObjectId(data._id)})
                .then(customs => {
                    var updateDeliveryOrder = [];
                    for(var dOrder of customs.deliveryOrders){
                        delete dOrder.customsId;
                        delete dOrder.customsNo;
                        dOrder.hasCustoms = false;
                        updateDeliveryOrder.push(this.deliveryOrderManager.update(dOrder));
                    }
                    Promise.all(updateDeliveryOrder)
                        .then(id => {
                            data._deleted = true;
                            this.collection.update(data)
                                .then(id => {
                                    resolve(id);
                                })
                                .catch(e => {
                                    reject(e);
                                })
                        })
                        .catch(e => {
                            reject(e);
                        })
                })
                .catch(e => {
                    reject(e);
                })
        });
    }

    getCustomsReport(query){
        return new Promise((resolve, reject) => {
            var deletedQuery = {
                _deleted: false
            };
            var date = new Date();
            var dateString = moment(date).format('YYYY-MM-DD');
            var dateNow = new Date(dateString);
            var dateBefore = dateNow.setDate(dateNow.getDate() - 30);
            var dateQuery = {
                "customsDate": {
                    "$gte": (!query || !query.dateFrom ? (new Date(dateBefore)) : (new Date(query.dateFrom))),
                    "$lte": (!query || !query.dateTo ? date : (new Date(query.dateTo + "T23:59")))
                }
            };
            var customsNoQuery = {};
            if(query.no){
                customsNoQuery = {
                    "no" : query.no
                }
            }
            var supplierQuery = {};
            if(query.supplier){
                supplierQuery = {
                    "supplierId" : new ObjectId(query.supplier)
                };
            }
            var customsTypeQuery = {};
            if(query.customsType){
                customsTypeQuery = {
                    "customsType" : query.customsType
                };
            }
            var Query = { "$and": [dateQuery, deletedQuery, supplierQuery, customsTypeQuery, customsNoQuery] };
            this.collection
                .aggregate([
                    {"$match" : Query }
                    ,{"$unwind" : "$deliveryOrders"}
                    ,{"$unwind" : "$deliveryOrders.items"}
                    ,{"$unwind" : "$deliveryOrders.items.fulfillments"}
                    ,{"$project" : {
                        "no" : 1,
                        "customsType" : 1,
                        "customsDate" : 1,
                        "supplier" : "$supplier.name",
                        "productCode" : "$deliveryOrders.items.fulfillments.product.code",
                        "productName" : "$deliveryOrders.items.fulfillments.product.name",
                        "quantity" : "$deliveryOrders.items.fulfillments.deliveredQuantity",
                        "price" : "$deliveryOrders.items.fulfillments.pricePerDealUnit",
                        "uom" : "$deliveryOrders.items.fulfillments.purchaseOrderUom.unit",
                        "currency" : "$currency.code"
                    }},
                    {"$group" : {
                        "_id" : {"no" : "$no", "customsType" : "$customsType", "customsDate" : "$customsDate", "supplier" : "$supplier", "productCode" : "$productCode", "productName" : "$productName", "uom" : "$uom", "currency" : "$currency"},
                        "quantity" : {"$sum" : "$quantity"},
                        "price" : {"$sum" : {"$multiply":["$quantity","$price"]}}
                    }},
                    {"$sort" : {
                        "_id.customsDate" : 1,
                        "_id.supplier" : 1
                    }}
                ])
                .toArray()
                .then(results => {
                    resolve(results);
                })
                .catch(e => {
                    reject(e);
                });
        });
    }

    getCustomsReportXls(dataReport, query){
        return new Promise((resolve, reject) => {
            var xls = {};
            xls.data = [];
            xls.options = [];
            xls.name = '';

            var index = 0;
            var dateFormat = "DD/MM/YYYY";

            for(var data of dataReport.data){
                index++;
                var item = {};
                item["No"] = index;
                item["Jenis Dokumen"] = data._id.customsType ? data._id.customsType : '';
                item["Nomor Dokumen Pabean"] = data._id.no ? data._id.no : '';
                item["Tanggal Dokumen Pabean"] = data._id.customsDate ? moment(data._id.customsDate).format("DD/MM/YYYY") : '';
                item["Pemasok / Pengirim"] = data._id.supplier ? data._id.supplier : '';
                item["Kode Barang"] = data._id.productCode ? data._id.productCode : '';
                item["Nama Barang"] = data._id.productName ? data._id.productName : '';
                item["Jumlah"] = data.quantity ? data.quantity : '';
                item["Satuan"] = data._id.uom ? data._id.uom : '';
                item["Nilai Barang"] = data.price ? data.price : '';
                item["Mata Uang"] = data._id.currency ? data._id.currency : '';
                
                xls.data.push(item);
            }

            xls.options["No"] = "number";
            xls.options["Jenis Dokumen"] = "string";
            xls.options["Nomor Dokumen Pabean"] = "string";
            xls.options["Tanggal Dokumen Pabean"] = "string";
            xls.options["Pemasok / Pengirim"] = "string";
            xls.options["Kode Barang"] = "string";
            xls.options["Nama Barang"] = "string";
            xls.options["Jumlah"] = "number";
            xls.options["Satuan"] = "string";
            xls.options["Nilai Barang"] = "number";
            xls.options["Mata Uang"] = "string";

            if(query.dateFrom && query.dateTo){
                xls.name = `Bea Cukai Report ${moment(new Date(query.dateFrom)).format(dateFormat)} - ${moment(new Date(query.dateTo)).format(dateFormat)}.xlsx`;
            }
            else if(!query.dateFrom && query.dateTo){
                xls.name = `Bea Cukai Report ${moment(new Date(query.dateTo)).format(dateFormat)}.xlsx`;
            }
            else if(query.dateFrom && !query.dateTo){
                xls.name = `Bea Cukai Report ${moment(new Date(query.dateFrom)).format(dateFormat)}.xlsx`;
            }
            else
                xls.name = `Bea Cukai Report.xlsx`;
            
            resolve(xls);
        });
    }

    _createIndexes() {
        var dateIndex = {
            name: `ix_${map.garmentPurchasing.collection.Customs}__updatedDate`,
            key: {
                date: -1
            }
        };

        var noIndex = {
            name: `ix_${map.garmentPurchasing.collection.Customs}_no_customsDate_validateDate_supplierId`,
            key: {
                no: 1,
                customsDate: 1,
                validateDate: 1,
                supplierId: 1
            },
            unique: true
        };

        return this.collection.createIndexes([dateIndex, noIndex]);
    }
}