const cheerio = require('cheerio');
const request = require('request');
const http = require('http');

class Zaha {
    constructor () {
        let page = 2;
        this.results = [];
        this.singleRealState = {
            source: {},
            characteristics: {
                pricing: {}
            },
            location: {
                geolocation: {}
            },
            features: {
                essencials: {},
                amenities: {
                    all: []
                }
            }
        };

        let urlSale = 'https://www.vivareal.com.br/venda/?__vt=prefetch:c&pagina=' + page;
        let urlRent = 'https://www.vivareal.com.br/aluguel/?__vt=prefetch:c&pagina=' + page;

        do {
            page = page + 1;

            this.getBody(urlRent, this.getBasicInfo.bind(this));
        } while (page <= 2);
        
    }

    getBody (url, callback) {

        request(url, (err, res, body) => {
            if (err) throw err;

            if (res.statusCode !== 200) {
                console.log('Status code: ' + res.statusCode);
                return;
            }

            if (!callback) return body;

            callback(body);

        }, this);
    }

    getBasicInfo (body) {
        if (!body) return;

        const $ = cheerio.load(body, { decodeEntities: false });

        let realStates = $('.hbs-results-pages__property-card');

        realStates.map((index, item) => {          
            this.singleRealState.characteristics.title = $(item).find('.js-card-title').html();
            this.singleRealState.characteristics.description = $(item).find('.ko').html();
            this.singleRealState.characteristics.area = parseInt($(item).find('.js-property-card-detail-area').html());
            this.singleRealState.characteristics.images = $(item).find('.js-propertyCard').attr('data-images');
            this.singleRealState.source.url = $(item).find('.js-card-title').attr('href');
            this.singleRealState.characteristics.pricing.condominium = this.parseValues($(item).find('.js-condo-price').html());

            
            this.singleRealState.location = this.getAddress($, item, '.js-property-card-address');


            this.getBody('https://www.vivareal.com.br/' + this.singleRealState.source.url, this.getAdvancedInfo.bind(this));

        }, this);

    }

    getAdvancedInfo (body) {
        if (!body) return;

        const $ = cheerio.load(body, { decodeEntities: false });
        let advancedInfo = {
            all: []
        };

        advancedInfo.name = $('.creci').prev().html();
        advancedInfo.code = $('.js-title-code').html();
        advancedInfo.propertyType = $('.js-detail-type-value').html();
        advancedInfo.categories = this.getCategories($, '.js-title-main-info');
        advancedInfo.purchase = this.parseValues($('.js-detail-sale-price').html());
        advancedInfo.rent = this.parseValues($('.js-detail-rent-price').html());
        advancedInfo.tax = this.parseValues($('.js-detail-iptu-price').html());
        advancedInfo.rooms = this.parseValues($('.js-detail-rooms').find('.bF').html());
        advancedInfo.suites = this.parseValues($('.js-detail-rooms').find('.bJ').html());
        advancedInfo.bathrooms = this.parseValues($('.js-detail-bathrooms').find('span').html());
        advancedInfo.kitchens = this.checkForEssencials($, 'cozinha');
        advancedInfo.serviceArea = this.checkForEssencials($, 'área de serviço');
        advancedInfo.parkingSpace = this.parseValues($('.js-detail-parking-spaces').find('.bF').html());
        advancedInfo.all.push($('.bS > li').html());

        this.joinInfos(advancedInfo);
        
    }

    joinInfos (advancedInfo) {
        this.singleRealState.source.name = advancedInfo.name;
        this.singleRealState.source.code = advancedInfo.code;
        this.singleRealState.characteristics.propertyType = advancedInfo.propertyType;
        this.singleRealState.characteristics.categories = advancedInfo.categories;
        this.singleRealState.characteristics.pricing.purchase = advancedInfo.purchase;
        this.singleRealState.characteristics.pricing.rent = advancedInfo.rent;
        this.singleRealState.characteristics.pricing.tax = advancedInfo.tax;
        this.singleRealState.features.essencials.rooms = advancedInfo.rooms;
        this.singleRealState.features.essencials.suites = advancedInfo.suites;
        this.singleRealState.features.essencials.bathrooms = advancedInfo.bathrooms;
        this.singleRealState.features.essencials.kitchens = advancedInfo.kitchens;
        this.singleRealState.features.essencials.serviceArea = advancedInfo.serviceArea;
        this.singleRealState.features.essencials.parkingSpace = advancedInfo.parkingSpace;
        this.singleRealState.features.amenities.all = advancedInfo.all;

        this.post();

    }

    checkForEssencials ($, query) {
        let wrapper = $('.bS > li').html().toLowerCase();

        if (wrapper == query) return true;

        return false;
    }

    parseValues (value) {
        if(!value) return 0;
        value = value.replace(/[\D]/g, '');
        value = parseInt(value);

        return value;
    }

    getCategories ($, htmlClass) {
        let title = $(htmlClass).html();
        title = title.toLowerCase();
        let type = [];

        if(title.search('venda') > -1 || title.search('vender') > -1) {
            type.push('sell');
        }

        if(title.search('alugar') > -1 || title.search('aluguel') > -1) {
            type.push('rent');
        } 

        return type;
    }

    getAddress ($, item, htmlClass) {
        let addressObj = {
            geolocation: {}
        };
        let fullAddress = $(item).find(htmlClass).find('span').html();

        let url = 'https://maps.googleapis.com/maps/api/geocode/json?address=' + fullAddress + '&key=AIzaSyC-652MU3cZE-LlGdEf0_ZvS9JZ52eno8Q';

        request(url, (err, res, body) => {
            if (err || !body) throw err;

            if (res.statusCode != 200) {
                console.log('Status code: ' + res.statusCode);
                return;
            }

            body = JSON.parse(body);
            let addressComponents = body.address_components;


            addressComponents.map(item => {
                if(item.type.includes('postal_code')) addressObj.zipcode = item.long_name;
                if(item.type.includes('route')) addressObj.street = item.long_name;
                if(item.type.includes('street_number')) addressObj.number = item.long_name;
                if(item.type.includes('sublocality')) addressObj.district = item.long_name;
                if(item.type.includes('administrative_area_level_2')) addressObj.city = item.long_name;
                if(item.type.includes('administrative_area_level_1')) addressObj.state = item.long_name;
                if(item.type.includes('country')) addressObj.country = item.long_name;
                addressObj.geolocation.latitude = JSON.parse(item.geometry.location.lat);
                addressObj.geolocation.longitude = JSON.parse(item.geometry.location.lng);
            });

        })        
    }

    post () {
        // request({
        //     url: "https://niemeyer.hackaetano.com/properties",
        //     method: "POST",
        //     json: true, 
        //     body: this.singleRealState,
        // }, function (error, response, body){
        //     console.log(response);
        // }); 
    }
}

module.exports = new Zaha;




