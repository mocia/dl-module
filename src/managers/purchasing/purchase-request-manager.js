'use strict'

var ObjectId = require("mongodb").ObjectId;
require('mongodb-toolkit');
var DLModels = require('dl-models');
var map = DLModels.map;
var PurchaseRequest = DLModels.purchasing.PurchaseRequest;
var generateCode = require('../../utils/code-generator');
var BaseManager = require('../base-manager');
var i18n = require('dl-i18n');
var UnitManager = require('../master/unit-manager');
var BudgetManager = require('../master/budget-manager');
var CategoryManager = require('../master/category-manager');
var ProductManager = require('../master/product-manager');

module.exports = class PurchaseRequestManager extends BaseManager {
    constructor(db, user) {
        super(db, user);
        this.moduleId = 'PR';
        this.year = (new Date()).getFullYear().toString().substring(2, 4);
        this.collection = this.db.use(map.purchasing.collection.PurchaseRequest);
        this.unitManager = new UnitManager(db, user);
        this.budgetManager = new BudgetManager(db, user);
        this.categoryManager = new CategoryManager(db, user);
        this.productManager = new ProductManager(db, user);
    }

    _validate(purchaseRequest) {
        var errors = {};
        return new Promise((resolve, reject) => {
            var valid = purchaseRequest;

            var getPurchaseRequestPromise = this.collection.singleOrDefault({
                _id: {
                    '$ne': new ObjectId(valid._id)
                }
            });

            var getUnit = valid.unitId && valid.unitId.toString().trim() != '' ? this.unitManager.getSingleByIdOrDefault(valid.unitId) : Promise.resolve(null);
            var getCategory = valid.categoryId && valid.categoryId.toString().trim() != '' ? this.categoryManager.getSingleByIdOrDefault(valid.categoryId) : Promise.resolve(null);
            var getBudget = valid.budgetId && valid.budgetId.toString().trim() != '' ? this.budgetManager.getSingleByIdOrDefault(valid.budgetId) : Promise.resolve(null);
            var getProduct = [];

            valid.items = valid.items instanceof Array ? valid.items : [];
            for (var _item of valid.items)
                getProduct.push(_item.productId && _item.productId.toString().trim() != '' ? this.productManager.getSingleByIdOrDefault(_item.productId) : Promise.resolve(null));

            Promise.all([getPurchaseRequestPromise, getUnit, getCategory, getBudget].concat(getProduct))
                .then(results => {
                    var _module = results[0];
                    var _unit = results[1];
                    var _category = results[2];
                    var _budget = results[3];
                    var _products = results.slice(4, results.length);
                    var now = new Date();

                    if (!valid.date || valid.date == '' || valid.date == "undefined")
                        errors["date"] = i18n.__("PurchaseRequest.date.isRequired:%s is required", i18n.__("PurchaseRequest.date._:Date")); //"Tanggal PR tidak boleh kosong";

                    if (!_unit)
                        errors["unit"] = i18n.__("PurchaseRequest.unit.isRequired:%s is not exists", i18n.__("PurchaseRequest.unit._:Unit")); //"Unit tidak boleh kosong";
                    else if (!valid.unitId)
                        errors["unit"] = i18n.__("PurchaseRequest.unit.isRequired:%s is required", i18n.__("PurchaseRequest.unit._:Unit")); //"Unit tidak boleh kosong";
                    else if (valid.unit) {
                        if (!valid.unit._id)
                            errors["unit"] = i18n.__("PurchaseRequest.unit.isRequired:%s is required", i18n.__("PurchaseRequest.unit._:Unit")); //"Unit tidak boleh kosong";
                    }
                    else if (!valid.unit)
                        errors["unit"] = i18n.__("PurchaseRequest.unit.isRequired:%s is required", i18n.__("PurchaseRequest.unit._:Unit")); //"Unit tidak boleh kosong";


                    if (!_category)
                        errors["category"] = i18n.__("PurchaseRequest.category.isRequired:%s is not exists", i18n.__("PurchaseRequest.category._:Category")); //"Category tidak boleh kosong";
                    else if (!valid.categoryId)
                        errors["category"] = i18n.__("PurchaseRequest.category.isRequired:%s is required", i18n.__("PurchaseRequest.category._:Category")); //"Category tidak boleh kosong";
                    else if (valid.category) {
                        if (!valid.category._id)
                            errors["category"] = i18n.__("PurchaseRequest.category.isRequired:%s is required", i18n.__("PurchaseRequest.category._:Category")); //"Category tidak boleh kosong";
                    }
                    else if (!valid.category)
                        errors["category"] = i18n.__("PurchaseRequest.category.isRequired:%s is required", i18n.__("PurchaseRequest.category._:Category")); //"Category tidak boleh kosong";

                    if (!_budget)
                        errors["budget"] = i18n.__("PurchaseRequest.budget.name.isRequired:%s is not exists", i18n.__("PurchaseRequest.budget.name._:Budget")); //"Budget tidak boleh kosong";
                    else if (!valid.budget._id)
                        errors["budget"] = i18n.__("PurchaseRequest.budget.name.isRequired:%s is required", i18n.__("PurchaseRequest.budget.name._:Budget")); //"Budget tidak boleh kosong";

                    if (!valid.expectedDeliveryDate || valid.expectedDeliveryDate == '' || valid.expectedDeliveryDate == 'undefined')
                        valid.expectedDeliveryDate = "";

                    if (valid.items && valid.items.length <= 0) {
                        errors["items"] = i18n.__("PurchaseRequest.items.isRequired:%s is required", i18n.__("PurchaseRequest.items._:Item")); //"Harus ada minimal 1 barang";
                    }
                    else {
                        var itemErrors = [];
                        for (var item of valid.items) {
                            var itemError = {};
                            if (!item.product || !item.product._id)
                                itemError["product"] = i18n.__("PurchaseRequest.items.product.name.isRequired:%s is required", i18n.__("PurchaseRequest.items.product.name._:Name")); //"Nama barang tidak boleh kosong";
                            if (item.quantity <= 0)
                                itemError["quantity"] = i18n.__("PurchaseRequest.items.quantity.isRequired:%s is required", i18n.__("PurchaseRequest.items.quantity._:Quantity")); //Jumlah barang tidak boleh kosong";
                            itemErrors.push(itemError);
                        }
                        for (var itemError of itemErrors) {
                            for (var prop in itemError) {
                                errors.items = itemErrors;
                                break;
                            }
                            if (errors.items)
                                break;
                        }
                    }

                    if (Object.getOwnPropertyNames(errors).length > 0) {
                        var ValidationError = require('../../validation-error');
                        reject(new ValidationError('data does not pass validation', errors));
                    }

                    valid.unitId = new ObjectId(valid.unitId);
                    valid.unit._id = new ObjectId(valid.unitId);
                    if (valid.category != null) {
                        valid.categoryId = new ObjectId(valid.category._id);
                        valid.category._id = new ObjectId(valid.category._id);
                    }

                    valid.unit = _unit;
                    valid.unitId = _unit._id;

                    valid.category = _category;
                    valid.categoryId = _category._id;

                    valid.budget = _budget;

                    for (var prItem of valid.items) {
                        for (var _product of _products) {
                            if (prItem.product._id.toString() == _product._id.toString()) {
                                prItem.product = _product;
                                prItem.uom = _product.uom;
                                break;
                            }
                        }
                    }

                    if (!valid.stamp)
                        valid = new PurchaseRequest(valid);

                    valid.stamp(this.user.username, 'manager');
                    resolve(valid);
                })
                .catch(e => {
                    reject(e);
                });
        });
    }

    _getQuery(paging) {
        var deletedFilter = {
                _deleted: false
            },
            keywordFilter = {};


        var query = {};

        if (paging.keyword) {
            var regex = new RegExp(paging.keyword, "i");

            var filterNo = {
                'no': {
                    '$regex': regex
                }
            };

            var filterUnitDivisionName = {
                "unit.division.name": {
                    '$regex': regex
                }
            };
            var filterUnitName = {
                "unit.name": {
                    '$regex': regex
                }
            };

            var filterCategory = {
                "category.name": {
                    '$regex': regex
                }
            };

            keywordFilter = {
                '$or': [filterNo, filterUnitDivisionName, filterUnitName, filterCategory]
            };
        }
        query = {
            '$and': [deletedFilter, paging.filter, keywordFilter]
        }
        return query;
    }

    create(purchaseRequest) {
        //purchaseRequest = new PurchaseRequest(purchaseRequest);
        return new Promise((resolve, reject) => {
            var dateFormat = "MMYY";
            var locale = 'id-ID';
            var moment = require('moment');
            moment.locale(locale);
            this._validate(purchaseRequest)
                .then(validPurchaseRequest => {
                    validPurchaseRequest.no = `${validPurchaseRequest.budget.code}${validPurchaseRequest.unit.code}${validPurchaseRequest.category.code}${moment(validPurchaseRequest.date).format(dateFormat)}${generateCode()}`;
                    if (validPurchaseRequest.expectedDeliveryDate == "undefined") {
                        validPurchaseRequest.expectedDeliveryDate = "";
                    }
                    this.collection.insert(validPurchaseRequest)
                        .then(id => {
                            resolve(id);
                        })
                        .catch(e => {
                            reject(e);
                        });
                })
                .catch(e => {
                    reject(e);
                })

        });
    }

    post(listPurchaseRequest) {
        var purchaseRequests = [];
        var tasks = [];
        return new Promise((resolve, reject) => {
            for (var purchaseRequest of listPurchaseRequest) {
                purchaseRequests.push(this.getSingleByIdOrDefault(purchaseRequest._id));
            }
            Promise.all(purchaseRequests)
                .then(validPurchaseRequest => {
                    for (var pr of listPurchaseRequest) {
                        for (var _pr of validPurchaseRequest) {
                            if (_pr._id.equals(pr._id)) {
                                _pr.isPosted = true;
                                tasks.push(this.update(_pr));
                                break;
                            }
                        }

                    }
                    Promise.all(tasks)
                        .then(result => {
                            resolve(result);
                        })
                        .catch(e => {
                            reject(e);
                        })

                })
                .catch(e => {
                    reject(e);
                });
        });

    }

    pdf(id) {
        return new Promise((resolve, reject) => {

            this.getSingleById(id)
                .then(purchaseRequest => {
                    var getDefinition = require('../../pdf/definitions/purchase-request');
                    var definition = getDefinition(purchaseRequest);

                    var generatePdf = require('../../pdf/pdf-generator');
                    generatePdf(definition)
                        .then(binary => {
                            resolve(binary);
                        })
                        .catch(e => {
                            reject(e);
                        });
                })
                .catch(e => {
                    reject(e);
                });

        });
    }

    getDataPRMonitoring(unitId, categoryId, budgetId, PRNo, dateFrom, dateTo) {
        return new Promise((resolve, reject) => {
            var sorting = {
                "date": -1,
                "no": 1
            };
            var query = {};
            if (unitId != "undefined" && unitId != "" && categoryId != "undefined" && categoryId != "" && budgetId != "undefined" && budgetId != "" && PRNo != "undefined" && PRNo != "" && dateFrom != "undefined" && dateFrom != "" && dateFrom != "null" && dateTo != "undefined" && dateTo != "" && dateTo != "null") {
                query = {
                    unitId: new ObjectId(unitId),
                    categoryId: new ObjectId(categoryId),
                    "no": PRNo,
                    "budget._id": new ObjectId(budgetId),
                    date: {
                        $gte: dateFrom,
                        $lte: dateTo
                    }
                };
            }
            else if (unitId != "undefined" && unitId != "" && categoryId != "undefined" && categoryId != "" && budgetId != "undefined" && budgetId != "" && PRNo != "undefined" && PRNo != "") {
                query = {
                    unitId: new ObjectId(unitId),
                    categoryId: new ObjectId(categoryId),
                    "no": PRNo,
                    "budget._id": new ObjectId(budgetId)
                };
            }
            else if (unitId != "undefined" && unitId != "" && categoryId != "undefined" && categoryId != "" && budgetId != "undefined" && budgetId != "") {
                query = {
                    unitId: new ObjectId(unitId),
                    categoryId: new ObjectId(categoryId),
                    "budget._id": new ObjectId(budgetId)
                };
            }
            else if (unitId != "undefined" && unitId != "" && categoryId != "undefined" && categoryId != "") {
                query = {
                    unitId: new ObjectId(unitId),
                    categoryId: new ObjectId(categoryId)
                };
            }
            else if (unitId != "undefined" && unitId != "") {
                query = {
                    unitId: new ObjectId(unitId)
                };
            }
            else if (categoryId != "undefined" && categoryId != "") {
                query = {
                    categoryId: new ObjectId(categoryId)
                };
            }
            else if (budgetId != "undefined" && budgetId != "") {
                query = {
                    "budget._id": budgetId
                };
            }
            else if (PRNo != "undefined" && PRNo != "") {
                query = {
                    "no": PRNo
                };
                console.log(query);
            }
            else if (dateFrom != "undefined" && dateFrom != "" && dateFrom != "null" && dateTo != "undefined" && dateTo != "" && dateTo != "null") {
                query = {
                    date: {
                        $gte: dateFrom,
                        $lte: dateTo
                    }
                };
            }
            query = Object.assign(query, {
                _createdBy: this.user.username,
                _deleted: false,
                isPosted: true
            });
            this.collection.find(query).sort(sorting).toArray()
                .then(purchaseRequest => {
                    resolve(purchaseRequest);
                    console.log(purchaseRequest);
                })
                .catch(e => {
                    reject(e);
                });
        });
    }

    _createIndexes() {
        var dateIndex = {
            name: `ix_${map.purchasing.collection.PurchaseRequest}__updatedDate`,
            key: {
                _updatedDate: -1
            }
        }

        var noIndex = {
            name: `ix_${map.purchasing.collection.PurchaseRequest}_no`,
            key: {
                no: 1
            },
            unique: true
        }

        return this.collection.createIndexes([dateIndex, noIndex]);
    }
}
