const cheerio = require('cheerio');
const request = require('request');

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
        let limit = 1;

        realStates.map((index, item) => {          
            this.singleRealState.characteristics.title = $(item).find('.js-card-title').html();
            this.singleRealState.characteristics.description = $(item).find('.ko').html();
            this.singleRealState.characteristics.area = parseInt($(item).find('.js-property-card-detail-area').html());
            this.singleRealState.characteristics.images = $(item).find('.js-propertyCard').attr('data-images');
            this.singleRealState.source.url = $(item).find('.js-card-title').attr('href');
            this.singleRealState.characteristics.pricing.condominium = this.parseValues($(item).find('.js-condo-price').html());

            limit = limit + 1;

            if(limit > 4) {
                setTimeout(() => {
                    this.singleRealState.location = this.getAddress($, item, '.js-property-card-address');
                }, 5000);
            };

            this.getBody('https://www.vivareal.com.br/' + this.singleRealState.source.url, this.getAdvancedInfo.bind(this));

        }, this);

    }

    getAdvancedInfo (body) {
        if (!body) return;

        const $ = cheerio.load(body, { decodeEntities: false });

        this.singleRealState.source.name = $('.creci').prev().html();
        this.singleRealState.source.code = $('.js-title-code').html();
        this.singleRealState.characteristics.propertyType = $('.js-detail-type-value').html();
        this.singleRealState.characteristics.categories = this.getCategories($, '.js-title-main-info');
        this.singleRealState.characteristics.pricing.purchase = this.parseValues($('.js-detail-sale-price').html());
        this.singleRealState.characteristics.pricing.rent = this.parseValues($('.js-detail-rent-price').html());
        this.singleRealState.characteristics.pricing.tax = this.parseValues($('.js-detail-iptu-price').html());
        this.singleRealState.features.essencials.rooms = this.parseValues($('.js-detail-rooms').find('.bF').html());
        this.singleRealState.features.essencials.suites = this.parseValues($('.js-detail-rooms').find('.bJ').html());
        this.singleRealState.features.essencials.bathrooms = this.parseValues($('.js-detail-bathrooms').find('span').html());
        this.singleRealState.features.essencials.kitchens = this.checkForEssencials($, 'cozinha');
        this.singleRealState.features.essencials.serviceArea = this.checkForEssencials($, 'área de serviço');
        this.singleRealState.features.essencials.parkingSpace = this.parseValues($('.js-detail-parking-spaces').find('.bF').html());
        this.singleRealState.features.amenities.all.push($('.bS > li').html());

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
        // console.log(addressObj);
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




