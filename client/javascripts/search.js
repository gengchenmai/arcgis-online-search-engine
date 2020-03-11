var _STKO = {};

_STKO.searchTOPN = 1000;

_STKO.arcgisTypeDict = {};

_STKO.panelTypeDict = {
	"Maps": "maps",
	"Layers": "layers",
	"Tools": "tools",
	"Applications": "apps",
	"Data Files": "data"
};

_STKO.naiveSearch = function(searchText, topn){
	$(`#placeNR_Checkbox`).prop('checked', false);
	$(`#userLocation_Checkbox`).prop('checked', false);
	$(`#intelligentSearchField`).val(searchText);
	console.log(searchText);

	var curAPIPath = window.location.href;
	var url = `${curAPIPath}elasticsearch?text=${encodeURIComponent(searchText)}&topn=${topn}`;
	console.log(url);

	$("body").addClass("loading");
	$.ajax({
		url: url,
		type:'GET',
		dataType: 'json',
		// headers: {Connection: close},
		success: function(data, textStatus, xhr) {
			console.log(data);
			$("body").removeClass("loading");
			// _STKO.visulizePlaceNR(JSON.parse(data.placeNERresult));
			var panelIDs = ["all", "maps", "layers", "tools", "apps", "data"];
			panelIDs.forEach((panelID)=>{
				_STKO.visulizeSearchResult(data.hits, panelID);
				
			});
			
			
		},
		error: function(xhr, textStatus, errorThrown) {
			//console.log(url);
			console.log("error");
			//console.log(data.results.bindings)
			$("body").removeClass("loading");
		}
	});
}

_STKO.semanticSearch = function(searchText, topn){
	$(`#intelligentSearchField`).val(searchText);
	console.log(searchText);
	var doNER = 0;

	var isUseLocation = false;

	var curAPIPath = window.location.href;

	if($(`#placeNR_Checkbox`)[0].checked){
		doNER = 1;
		if($(`#userLocation_Checkbox`)[0].checked){
			isUseLocation = true;
			// var position = _STKO.getUserLocation((position)=>{
			// 	var latitude  = position.coords.latitude;
			// 	var longitude = position.coords.longitude;

			// 	var url = `${curAPIPath}search?text=${encodeURIComponent(searchText)}&topn=${topn}&doNER=${doNER}&lat=${latitude}&lon=${longitude}`;
			// 	_STKO.semanticSearchQuery(url, ()=>{
			// 		console.log("Semantic Search Finished");
			// 	});
			// });

			_STKO.getGeoLocationAPI((position)=>{
				console.log(position);
				if(position){
					var latitude  = position.location.lat;
					var longitude = position.location.lng;

					var url = `${curAPIPath}search?text=${encodeURIComponent(searchText)}&topn=${topn}&doNER=${doNER}&lat=${latitude}&lon=${longitude}`;
				}else{
					var url = `${curAPIPath}search?text=${encodeURIComponent(searchText)}&topn=${topn}&doNER=${doNER}`;
				}
				_STKO.semanticSearchQuery(url, ()=>{
					console.log("Semantic Search Finished");
				});

			});
		}else{
			var url = `${curAPIPath}search?text=${encodeURIComponent(searchText)}&topn=${topn}&doNER=${doNER}`;

			_STKO.semanticSearchQuery(url, ()=>{
				console.log("Semantic Search Finished");
			});
		}
	}else{
		$(`#userLocation_Checkbox`).prop('checked', false);

		var url = `${curAPIPath}search?text=${encodeURIComponent(searchText)}&topn=${topn}&doNER=${doNER}`;

		_STKO.semanticSearchQuery(url, ()=>{
			console.log("Semantic Search Finished");
		});
	}
}

_STKO.semanticSearchQuery = function(url, fk_query){
	console.log(url);

	$("body").addClass("loading");
	$.ajax({
		url: url,
		type:'GET',
		dataType: 'json',
		// headers: {Connection: close},
		success: function(data, textStatus, xhr) {
			console.log(data);
			$("body").removeClass("loading");
			_STKO.visulizePlaceNR(JSON.parse(data.placeNERresult));
			var panelIDs = ["all", "maps", "layers", "tools", "apps", "data"];
			panelIDs.forEach((panelID)=>{
				_STKO.visulizeSearchResult(data.hits, panelID);
				
			});
			fk_query();
			
		},
		error: function(xhr, textStatus, errorThrown) {
			//console.log(url);
			console.log("error");
			//console.log(data.results.bindings)
			$("body").removeClass("loading");
			fk_query();
		}
	});
}

_STKO.getUserLocation = function(fk_userLocation){
	if (!navigator.geolocation){
		// output.innerHTML = "<p>Geolocation is not supported by your browser</p>";
		console.log("Geolocation is not supported by your browser");
		return;
	}

	function success(position) {
		// var latitude  = position.coords.latitude;
		// var longitude = position.coords.longitude;
		console.log(position);
		fk_userLocation(position);

		// output.innerHTML = '<p>Latitude is ' + latitude + '° <br>Longitude is ' + longitude + '°</p>';

		// var img = new Image();
		// img.src = "https://maps.googleapis.com/maps/api/staticmap?center=" + latitude + "," + longitude + "&zoom=13&size=300x300&sensor=false";

		// output.appendChild(img);
	}

	function error() {
		// output.innerHTML = "Unable to retrieve your location";
		console.log("Unable to retrieve your location");
	}

	// output.innerHTML = "<p>Locating…</p>";

	navigator.geolocation.getCurrentPosition(success, error);
}

_STKO.getGeoLocationAPI = function(fk_google_geoloaction){

	var url = `https://www.googleapis.com/geolocation/v1/geolocate?key=[YOUR_API_KEY]`;

	$.ajax({
		url: url,
		type:'POST',
		dataType: 'json',
		// headers: {Connection: close},
		success: function(data, textStatus, xhr) {
			console.log(data);
			fk_google_geoloaction(data);
			
		},
		error: function(xhr, textStatus, errorThrown) {
			//console.log(url);
			console.log("error");
			fk_google_geoloaction(null);
		}
	});

}

_STKO.visulizePlaceNR = function(placeNERresult){
	console.log(placeNERresult);
	var tagHTML = "No annotate places Find!";
	if(placeNERresult !== null){
		var searchText = placeNERresult["@text"];
		var tagHTML = searchText;
		console.log(placeNERresult["Resources"]);
		if(placeNERresult.hasOwnProperty("Resources")){
			var placeNameList = [];
			for(let i = 0; i < placeNERresult["Resources"].length; i++){
				var url = placeNERresult["Resources"][i]["@URI"];
				var placeName = placeNERresult["Resources"][i]["@surfaceForm"];
				var types = placeNERresult["Resources"][i]["@types"];
				console.log(placeNERresult["Resources"][i]);
				if(types.includes("Schema:Place") ||  types.includes("DBpedia:Place") || types.includes("DBpedia:PopulatedPlace")){
					if(placeNameList.indexOf(placeName) === -1){
						var tagPlace = `<a href="${url}" title="${url}" target="_blank">${placeName}</a>`;
						tagHTML = tagHTML.replace(placeName, tagPlace);
						console.log(tagHTML);
						placeNameList.push(placeName);
					}
				}
				
				
			}
		}
		
	}
	console.log(tagHTML);
	$("#placeNR_Result").html(tagHTML);
	// var searchText = $("#intelligentSearchField").val().trim();
	// var tagHTML = searchText;
	// for(var url in placeInfoList){
	// 	var offset = placeInfoList[url]["offset"];
	// 	var placeName = placeInfoList[url]["word"];

	// 	var tagPlace = `<a href="${url}" title="${url}" target="_blank">${placeName}</a>`;
	// 	var proirText = tagHTML.substring(0, offset);
	// 	console.log(proirText);


	// }

}

_STKO.visulizeSearchResult = function(jsonResult, panelID){
	// The panelID means: all, maps, layers, tools, applactions, data

	// $("#intelligentResultPanelContainer").fadeIn();
	var resultPanel = $(`#ResultPanel_${panelID}`);
	resultPanel.empty();
	
	var numOfResult = 0;
	
	for(let i = 0; i < jsonResult.length; i++){
		// let n_li = $("<li class=\"span4 item round shadow row-fluid\"></li>");
		let cur_item = jsonResult[i]._source;

		let type = cur_item.type;
		let generalType = _STKO.arcgisTypeDict[type];
		let correct_panelID = _STKO.panelTypeDict[generalType];


		if(panelID === "all" || correct_panelID == panelID)
		{
			numOfResult += 1;
			let id = cur_item.id;
			let title = cur_item.title;
			let thumbnail = cur_item.thumbnail;
			let sim_score = parseFloat(jsonResult[i]["_score"]);
			sim_score = Math.round(sim_score*10000)/10000;

			
			let snippet = cur_item.snippet;

			let n_li = $(`<li class="span4 item round shadow row-fluid"></li>`);
			let n_map = $(`<div id="${id}_${panelID}" class="thumbnail mousePointer"></div>`);
			let n_item = $(`<div style="height:290px;overflow:hidden"></div>`);

			if(thumbnail == null){
				var n_img = $(`<img class="item-logo" style="display: block; margin: auto;" src="http://static.arcgis.com/images/desktopapp.png"></img>`);
			}else{
				let imgURI = _STKO.constructThumbnailURI(id, thumbnail);
				var n_img = $(`<img class="item-logo" style="display: block; margin: auto;" src="${imgURI}"></img>`);
			}

			


			n_img.appendTo($(`<div class="span12" style="text-align: center;"></div>`)).appendTo(n_item);
			// n_li.append($(`<span class="col-md-6">${cur_item.id}</span>`));

			let title_text = _UTIL.textWarper(title, 60);
			n_item.append($(`<strong class="text:bolder">${title_text}</strong>`));
			
			let n_tags = ($(`<div class="row" style="text-align: center"></div>`));
			let n_type_tag = _STKO.constructArcGIGItemTypeTag(type).appendTo(n_tags);
			n_item.append(n_tags);

			n_item.append($(`<strong class="text:bolder;color:red;">${sim_score}</strong>`));

			let descrip_text = _UTIL.textWarper(snippet, 60);
			if(descrip_text !== null){
				n_item.append($(`<div class="break-word text-left" style="padding:0 10px;">${descrip_text}</div>`));
			}
			
			


			n_map.append(n_item);



			n_bottomText = $(`<div style="padding:0 0 0 10px;"></div>`);
			
			n_url = $(`<a target="_blank" href="http://www.arcgis.com/home/item.html?id=${id}"><span class="bold" style="width:30px;">Open ArcGIS Online Item</span></a>`);
			n_bottomText.append(n_url);


			n_map.append(n_item);
			n_map.append(n_bottomText);
			n_li.append(n_map);

			resultPanel.append(n_li);
		}

	}

	var numOfResult_panel = $(`#numOfResult_${panelID}`);
	numOfResult_panel.text(`Return ${numOfResult} results`);
}

_STKO.constructThumbnailURI = function(id, thumbnailShortPath){
	let thumbnailURI = "";
	let imgName = thumbnailShortPath.split("/")[1];
	let imgURI = `http://www.arcgis.com/sharing/rest/content/items/${id}/info/thumbnail/${imgName}`;
	return imgURI;
}

// _STKO.constructArcGISItemURI = function(id, itemType){
// 	// Set([u'Tile Package', u'Style', u'Shapefile', u'KML', u'Mobile Application', u'Application', u'Map Package', u'Service Definition', u'Web Map', u'Geometry Service', u'Vector Tile Service', u'Code Attachment', u'Symbol Set', u'Color Set', u'Map Document', u'Layer Template', u'Feature Collection', u'Featured Items', u'Web Mapping Application', u'Image Service', u'Feature Service', u'Native Application Template', u'PDF', u'CSV', u'Application Configuration', u'Layer', u'Globe Service', u'Geocoding Service', u'Explorer Map', u'Map Service', u'Network Analysis Service', u'Layer Package', u'Feature Collection Template', u'Web Scene', u'Document Link', u'File Geodatabase', u'Image', u'Geoprocessing Service'])
// }

_STKO.constructArcGIGItemTypeTag = function(type){
	let generalType = _STKO.arcgisTypeDict[type];
	let panelID = _STKO.panelTypeDict[generalType];
	let n_tag = $(`<span class="tagbox"></span>`);
	// n_tag.click(() => {
	// 	_STKO.simpleSemanticSearch(type, _STKO.searchTOPN);
	// });
	// let n_tagText = $(`<a class="taglink" href="javascript:_STKO.simpleSemanticSearch(${type}, ${_STKO.searchTOPN});">${type}</a>`);
	let n_tagText = $(`<a class="taglink" href="#${panelID}">${type}</a>`);
	let n_tagIcon = $(`<img class="tagIcon" src="/img/esri_type_tag.jpg"></img>`);

	n_tag.append(n_tagText);
	n_tag.append(n_tagIcon);

	return n_tag;
}

_STKO.readArcGISItemTypeDict = function(){
	var curAPIPath = window.location.href;
	var url = `${curAPIPath}type_dict`;
	$("body").addClass("loading");
	$.ajax({
		url: url,
		type:'GET',
		dataType: 'json',
		// headers: {Connection: close},
		success: function(data, textStatus, xhr) {
			console.log(data);
			// _STKO.arcgisTypeDict = JSON.parse(data);
			_STKO.arcgisTypeDict = data;
			console.log(_STKO.arcgisTypeDict);
			console.log(_STKO.arcgisTypeDict["Symbol Set"]);
			console.log(_STKO.arcgisTypeDict["Statistical Data Collection"]);
			console.log(_STKO.arcgisTypeDict["Form"]);
			$("body").removeClass("loading");

			// _STKO.visulizeSearchResult(data);
		},
		error: function(xhr, textStatus, errorThrown) {
			//console.log(url);
			console.log("error");
			//console.log(data.results.bindings)
			$("body").removeClass("loading");
		}
	});
}

// _STKO.readArcGISItemTypeDict = function(){
// 	let filePath = "/data/arcgis-item-classification.txt"
// 	var rawFile = new XMLHttpRequest();
// 	rawFile.open("GET", filePath, false);
// 	rawFile.onreadystatechange = function ()
// 	{
// 		if(rawFile.readyState === 4)
// 		{
// 			if(rawFile.status === 200 || rawFile.status == 0)
// 			{
// 				var allText = rawFile.responseText;
				
// 				var lines = allText.split("\n");
// 				// console.log(lines);
// 				for(let i = 0; i < lines.length; i++){
// 					let itemTuple = lines[i].split("\t");
// 					_STKO.arcgisTypeDict[itemTuple[1]] = itemTuple[0];
// 				}

// 				console.log(_STKO.arcgisTypeDict);
				
// 			}
// 		}
// 	}
// 	rawFile.send(null);
// }


