const cheerio = require('cheerio');
const request = require('request');
const fs = require('fs');
let singleRealState = {
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
class Zaha {
    constructor () {
        let page = 30;

        do {
            page = page + 1;

            let urlSale = 'https://www.vivareal.com.br/venda/?__vt=prefetch:c&pagina=' + page;
            let urlRent = 'https://www.vivareal.com.br/aluguel/?__vt=prefetch:c&pagina=' + page;
            this.getBody(urlRent, this.getBasicInfo.bind(this)); 

            console.log(page);       
        } while (page < 40);
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
        realStates = realStates.slice(0, 19);

        realStates.map((index, item) => {   
            singleRealState.source.url = $(item).find('.js-card-title').attr('href');

            singleRealState.characteristics.title = $(item).find('.js-card-title').html();
            singleRealState.characteristics.images = $('[data-images]').attr('data-images').replace(/[\[\]]/g, '').split(',').slice(0,5);

            this.getBody('https://www.vivareal.com.br/' + singleRealState.source.url, this.getAdvancedInfo.bind(this));

        }, this);

    }

    getAdvancedInfo (body) {
        if (!body) return;

        const $ = cheerio.load(body, { decodeEntities: false });
        
        this.getAddress($, '.js-title-location');
        singleRealState.source.title = $('.js-title-main-info').html();
        singleRealState.source.name = 'Viva Real';
        singleRealState.source.code = $('.js-title-code').html();
        singleRealState.characteristics.propertyType = $('.js-detail-type-value').html();
        singleRealState.characteristics.categories = this.getCategories($, '.js-title-main-info');
        singleRealState.characteristics.pricing.purchase = this.parseValues($('.js-detail-sale-price').html());
        singleRealState.characteristics.pricing.rent = this.parseValues($('.js-detail-rent-price').html());
        singleRealState.characteristics.pricing.tax = this.parseValues($('.js-detail-iptu-price').html());
        singleRealState.characteristics.pricing.condominium = this.parseValues($('.js-detail-condo-price').html());
        singleRealState.characteristics.area = parseInt($('.js-detail-area-value').html());
        singleRealState.characteristics.description = $('.js-description-and-features > .bP').html().replace(/<\/?[^>]+(>|$)/g, "");
        singleRealState.features.essencials.rooms = this.parseValues($('.js-detail-rooms').find('.bF').html());
        singleRealState.features.essencials.suites = this.parseValues($('.js-detail-rooms').find('.bJ').html());
        singleRealState.features.essencials.bathrooms = this.parseValues($('.js-detail-bathrooms').find('span').html());
        singleRealState.features.essencials.kitchens = this.checkForEssencials($, 'cozinha');
        singleRealState.features.essencials.serviceArea = this.checkForEssencials($, 'área de serviço');
        singleRealState.features.essencials.parkingSpace = this.parseValues($('.js-detail-parking-spaces').find('.bF').html());
        singleRealState.features.amenities.all.push($('.bS > li').html());

    }

    checkForEssencials ($, query) {

        let wrapper = $('.bS > li').html()
        if(!wrapper) return false;

        wrapper = wrapper.toLowerCase();

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

    getAddress ($, htmlClass) {
        let addressObj = {
            geolocation: {}
        };
        let fullAddress = $(htmlClass).html();

        let url = 'https://maps.googleapis.com/maps/api/geocode/json?address=' + fullAddress + '&key=AIzaSyC-652MU3cZE-LlGdEf0_ZvS9JZ52eno8Q';

        request(url, (err, res, body) => {
            if (err || !body) throw err;

            if (res.statusCode != 200) return;

            body = JSON.parse(body);
            let result = body.results[0];

            result.address_components.map(item => {
                if(item.types.includes('postal_code')) addressObj.zipcode = item.long_name;
                if(item.types.includes('route')) addressObj.street = item.long_name;
                if(item.types.includes('street_number')) addressObj.number = item.long_name;
                if(item.types.includes('sublocality')) addressObj.district = item.long_name;
                if(item.types.includes('administrative_area_level_2')) addressObj.city = item.long_name;
                if(item.types.includes('administrative_area_level_1')) addressObj.state = item.long_name;
                if(item.types.includes('country')) addressObj.country = item.long_name;
                addressObj.geolocation.latitude = JSON.parse(result.geometry.location.lat);
                addressObj.geolocation.longitude = JSON.parse(result.geometry.location.lng);
            });

            singleRealState.location = addressObj;
        }); 
        this.post(singleRealState);

    };

    post (data) {
        request({
            url: "https://niemeyer.hackaetano.com/properties/",
            method: "POST",
            json: true, 
            body: data,
        }, function (error, response, body){
            console.log(error);
            console.log(response);
        }); 
    }
}

module.exports = new Zaha;




