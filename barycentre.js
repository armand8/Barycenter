var geocoder;
var map;
var userTravelMode = "DRIVING";
var data = [];
var markers = [];
var barycentreMarkerList = [];
var destination = [];


/* Initialisation de la carte */
function initialize() {

    var latlng = new google.maps.LatLng(48.853, 2.35);
    var mapOptions = {
        zoom: 5,
        center: latlng
    }

    geocoder = new google.maps.Geocoder();
    map = new google.maps.Map(document.getElementById('map'), mapOptions);

    $("#DRIVING").css('color' , 'white')

}

/* Autocomplete à chaque modification d'une adresse*/
function placeInputChanged(event) {

    var inputAdressTarget = $(this.event.target).parent().parent().parent().parent().get(0).id;
    var predictions = new google.maps.places.AutocompleteService();
    $("#results").empty();
    var displaySuggestions = function (predictions) {
        predictions.reverse();
        predictions.forEach(function (prediction) {
            $("#results").prepend('<a onclick="setPlace()" class="result-place" id="' + inputAdressTarget + '">' + prediction.description + '</a><hr class="my-4">');
            if ($('#results a').length > 5) {
                $('#results a:last').remove();
            }
        });
    }

    predictions.getQueryPredictions({input: this.event.target.value}, displaySuggestions);

}

function setPlace(event) {
    placeUpdate(event);
    $('#' + this.event.target.id + '').find('#place').val(this.event.target.innerHTML);
    $('#results').empty();
}

function unshowBarycentre() {
    if (barycentreMarkerList.length > 0) {
        barycentreMarkerList[0].setMap(null);
        barycentreMarkerList = [];
    }
}

/* Au choix d'une adresse */
function placeUpdate(event, addOrRemove) {

    var bounds = new google.maps.LatLngBounds();

    /* Suppression de l'ancienne "place" si modification */
    if (data != null) {
        i = 0;
        data.forEach(function (place) {
            if (place.inputAdressTarget == this.event.target.id) {
                data.splice(i, 1);
            }
            i++;
        });
    }

    // Suppression de tous les markers
    delAllMarkers();

    /* Ajout de la "place" */
    if (this.event.target.id != '' && this.event.target.innerHTML != 'x') {
        data.push({inputAdressTarget: this.event.target.id, inputAdressValue: this.event.target.innerHTML});
    }
    var LatLngBounds = new google.maps.LatLngBounds();

    /* Génération des markers, récupération des latitudes/longitudes, centrage de la carte */
    data.forEach(function (place) {
        /* Générattion des markers*/
        geocoder.geocode({'address': place.inputAdressValue}, function (results) {
            var marker = new google.maps.Marker({
                map: map,
                position: results[0].geometry.location
            });
            markers.push(marker);

            /* Récupération des latitudes/longitudes */
            place.lat = results[0].geometry.location.lat();
            place.lng = results[0].geometry.location.lng();

            /* Centrage de la carte */
            var LatLngForBounds = new google.maps.LatLng(place.lat, place.lng);
            LatLngBounds.extend(LatLngForBounds);
            map.fitBounds(LatLngBounds);
            if (data.length == 1) {
                map.setZoom(12);
            }

        });
    });

    /* Récupartion du poids */
    data.forEach(function (place) {
        place.weight = parseFloat($('#' + place.inputAdressTarget + '').find('#weight').val());
    });

    if (data.length != 1) {
        calcBarycentre();
    }
}


function calcBarycentre() {

    // création du marker barycentre
    var barycentreMarker = new google.maps.Marker({
        //position: myLatLng,
        map: map,
        icon: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
        draggable: true,
        animation: google.maps.Animation.DROP,
    });

    var lat_nume = 0, lat_deno = 0, lat = 0, lng_nume = 0, lng_deno = 0, lng = 0, myLatLng;

    var i = 0;
    data.forEach(function (place) {

        /* Calcul du barycentre */
        if (typeof place.lat !== "undefined") {
            lat_nume = lat_nume + place.weight * place.lat;
            lat_deno = lat_deno + place.weight;
            lng_nume = lng_nume + place.weight * place.lng;
            lng_deno = lng_deno + place.weight;

            lat = lat_nume / lat_deno;
            lng = lng_nume / lng_deno;

            myLatLng = {lat: lat, lng: lng};


            /* On attend d'être sur la dernière "place" avant de pousser le marker du barycentre */
            if (i + 1 == data.length) {

                barycentreMarker.setPosition(myLatLng);

                barycentreMarkerList.push(barycentreMarker);

                var infowindow = new google.maps.InfoWindow;

                geocoder.geocode({'location': myLatLng}, function (results) {
                    if (results[1]) {
                        // Ajout dans les résultats de l'adresse du barycentre
                        //$("#results").prepend('<p>'+results[1].formatted_address+'</p>');
                        // Ajout de l'infowindow sur le marker barycentre
                        infowindow.setContent(results[0].formatted_address);

                        google.maps.event.addListener(barycentreMarker, 'click', function () {
                            infowindow.open(map, barycentreMarker);
                        });
                        infowindow.open(map, barycentreMarker);

                        destination = results[0].formatted_address;

                        distanceMatrix();

                    }
                });

                barycentreMarker.addListener('dragend', function () {
                    barycentreMarkerMoved(barycentreMarker.getPosition(), infowindow);
                });

            }
            i++;

        }
        else {

            setTimeout(calcBarycentre, 250);
        }
    });
}

function barycentreMarkerMoved(pos, barycentreMarkerinfowindow) {
    geocoder.geocode({'location': pos}, function (results) {
        barycentreMarkerinfowindow.setContent(results[0].formatted_address);
        log(results);
        destination = results[0].formatted_address;
        distanceMatrix();
    });

};

function distanceMatrix() {
    var origins = [], destinations = [];

    data.forEach(function (place) {
        origins.push(place.inputAdressValue)
        destinations.push(destination)
    });

    $("#results").empty();

    var service = new google.maps.DistanceMatrixService;
    service.getDistanceMatrix({
        origins: origins,
        destinations: destinations,
        travelMode: userTravelMode,
        unitSystem: google.maps.UnitSystem.METRIC,
        avoidHighways: false,
        avoidTolls: false
    }, function (response, status) {
        var i = 0;
        response.rows.every(function (row) {
            if (row.elements[0].status === "NOT_FOUND") {
                $("#results").append('<p class="result-place">Sorry, unresolved itinary. Please move the barycenter or change address.</p>');
                return false;
            }
            ;
            $("#results").append('<div id="container" class="results-travel"><div class="row">\
            <div class="col-8">' + response.originAddresses[i] + ' -> ' + destination + '</div>\
            <div class="col-4 distance-duration">' + row.elements[0].distance.text + '</br>' + row.elements[0].duration.text + '</div>\
            </div></div><hr class="my-4">');
            i++;
            return true;
        });
    });
}


function delAllMarkers() {
    /* Suppression de tous les markers */
    for (var i = 0; i < markers.length; i++) {
        markers[i].setMap(null);
    }
    ;
    markers = [];
    unshowBarycentre();
}

function changeTravelMode(event) {

    userTravelMode = $(this.event.target).attr('id');
    $(this.event.target).css('color', 'white');
    $(this.event.target).parent().siblings().children().css('color', 'lightgray');
    distanceMatrix();

}

function addWeight (event){

    $(this.event.target).parent().children('#weight').val(Number($(this.event.target).parent().children('#weight')[0].value) + 1);
    weightChanged($(this.event.target).parent().children('#weight'))
}

function weightChanged(event) {

    var placeValue ='';
    var inputID ='';
    var weight='';

    if (event === undefined) {
        // Si l'adresse est vide on ne cherche pas à mettre à jour le barycentre
        placeValue = $(this.event.target).parent().parent().find('#place').val();
        inputID = $(this.event.target).parent().parent().parent().parent().prop('id');
        weight = $(this.event.target).val();
    } else {
        placeValue = event.parent().parent().find('#place').val();
        inputID = event.parent().parent().parent().parent().prop('id');
        weight = event.val();
    }

    if (placeValue != "" && data.length > 1) {

        // Remplacement de la valeur de poids dans data
        data.forEach(function (place) {
            if (place.inputAdressTarget == inputID) {
                place.weight = parseFloat(weight);
            }
        });

        unshowBarycentre();
        calcBarycentre();
    }

}

var max_id = 2;
var numberOfPlaces = 2;

function addPlace() {


    max_id = max_id + 1;
    numberOfPlaces = numberOfPlaces + 1;
    $('#place-container').append('\
     <div id="place_' + max_id + '" class="place-div">\
      <div class="container">\
        <div class="row">\
        <div class="col-7 white-text">\
        <input id="place" type="text" placeholder="Enter a location"\
    oninput="placeInputChanged()" class="placeInput">\
        </div>\
        <div class="col-3 white-text">\
        <input type="number" value="1" id="weight" style="width: 30px"\
    onchange="weightChanged()" class="white-text text-group">\
        <i class="material-icons text-group" onclick="addWeight()">group_add</i>\
        </div>\
        <div class="col-2 lightgrey-text mouse-over">\
        <div onclick="removePlace()">\
        <i class="material-icons">delete_forever</i>\
        </div>\
        </div>\
        </div>\
        </div>\
        </div>\
');

}

function removePlace(event) {

    if (numberOfPlaces > 2) {
        numberOfPlaces = numberOfPlaces - 1;
        $(this.event.target).closest('[id]').remove();
    } else {
        $(this.event.target).parent().parent().parent().parent().find('#place').val('');
        $(this.event.target).parent().parent().parent().parent().find('#weight').val(1);
    }

    var inputID = $(this.event.target).parent().parent().parent().parent().parent().prop('id');
    data.forEach(function (place) {
        if (place.inputAdressTarget === inputID) {
            var index = data.indexOf(place);
            data.splice(index, 1);
            placeUpdate();
        }
    });

    $('#results').empty();
}

function log(toLog) {
    console.log(toLog);
}

google.maps.event.addDomListener(window, 'load', initialize);





