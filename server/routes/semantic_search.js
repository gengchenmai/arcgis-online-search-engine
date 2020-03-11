// const util = require('util');
var client = require ('./connection.js');

// var elasticsearch_type = "survey";
// var elasticsearch_type = "rest";
var elasticsearch_type = "recent";

// var numOfResult = 99;
var min_score = 1.2288;
var queryBoost = 1.0;

function elasticsearch(searchText, topn, fk_search){
	var numOfResult = 1000;
	if(topn){
		numOfResult = topn;
	}
	// console.log(topn);
	var queryBodyObj = {
		index: 'arcgis',
		type: elasticsearch_type,
		
		size: numOfResult,
		// _source: ["title", "id"],
		body: {
			query: {
				function_score: {
					query: {
						bool: {
							should: [
								{ match: { title: searchText } },
								{ match: { description: searchText } },
								{ match: { snippet: searchText } }
							]
						}
					}
				}
			}
		}
	};

	console.log(JSON.stringify(queryBodyObj.body));

	client.search(queryBodyObj,function (error, response,status) {
		if (error){
			console.log("search error: "+error)
		}
		else {
			// console.log('--- Response ---');
			// console.log('Total hits: ',response.hits.total);
			// console.log('--- Hits ---');
			// response.hits.hits.forEach(function(hit){
			// 	console.log(hit);
			// })

			fk_search(response.hits.hits);
			
		}
	});
}

function search(modelParam, searchKeywordObj, placeInfoList, inputVec, numOfConcept, topn, callback) {
	console.log(searchKeywordObj);
	var query_obj = elasticsearchParam_Constructor(modelParam, searchKeywordObj, placeInfoList, inputVec, numOfConcept);
	// var query_obj = getShouldQuery(modelParam, searchKeywordList, placeInfoList, inputVec, numOfConcept);
	var shouldList = query_obj.shouldList;
	var function_list = query_obj.function_list;
	var numOfResult = 1000;
	if(topn){
		numOfResult = topn;
	}
	// console.log(topn);
	// console.log(shouldList);
	// console.log(function_list[0].filter.match);
	console.log(modelParam);
	var queryBodyObj = {
		index: 'arcgis',
		type: elasticsearch_type,
		
		size: numOfResult,
		// _source: ["title", "id"],
		body: {
			min_score: min_score,
			query: {
				function_score: {
					query: {
						match_all: {}
						// bool : {
						// 	should : shouldList
						// }
					},
					boost: queryBoost,
					functions: function_list,
					
					// max_boost: 100,
					score_mode: "sum",
					boost_mode: "sum"
				}
			}
		}
	};

	// console.log(util.inspect(queryBodyObj, {showHidden: false, depth: null}));
	console.log(JSON.stringify(queryBodyObj.body));
	console.log(queryBodyObj.body);

	client.search(queryBodyObj,function (error, response,status) {
		if (error){
			console.log("search error: "+error)
		}
		else {
			// console.log('--- Response ---');
			// console.log('Total hits: ',response.hits.total);
			// console.log('--- Hits ---');
			// response.hits.hits.forEach(function(hit){
			// 	console.log(hit);
			// })

			callback(response.hits.hits);
			
		}
	});
}

function elasticsearchParam_Constructor(modelParam, searchKeywordObj, placeInfoList, inputVec, numOfConcept){
	var shouldList = [];
	var function_list = [];
	

	var fieldList = ["title", "description", "snippet"];
	

	console.log(placeInfoList);


	if(modelParam.thematic_factor !== 0){
		for(var i = 0; i < fieldList.length; i++){
			var cur_field = fieldList[i];
			var cur_field_factor = modelParam.thematic_field_factor[cur_field];

			if(cur_field_factor !== 0){
				for(var word in searchKeywordObj){
					var item = searchKeywordObj[word];
					var w2vList = item["w2v"];
					var sum = 0.0;
					for(var j = 0; j < w2vList.length; j++){
						sum += w2vList[j].dist;
					}
					var importance = item["importance"];


					// var shouldItem = {};
					// shouldItem.match = {};
					// shouldItem.match[cur_field] = word;
					// shouldList.push(shouldItem);

					for(var j = 0; j < w2vList.length; j++){
						// w2vList[i].dist = importance*w2vList[i].dist/sum;
						// searchKeywordList.push(w2vList[i]);

						var cur_word = w2vList[j].word;
						var cur_word_dist = w2vList[j].dist;

						shouldList.push({ match: { cur_field: cur_word}});
						var shouldItem = {};
						shouldItem.match = {};
						shouldItem.match[cur_field] = cur_word;
						shouldList.push(shouldItem);

						

						// According to the current field name and the similarity between the user's input word and current word (the value given by word2vec)
						// We assign weight for each filter
						// modelParam.thematic_factor: the themantic total weight
						// importance: the importance of current term, we need to use part-of-speech-tagging
						// cur_word_dist: (the sim_score between the word and original word)
						// cur_field_factor: the current field factor
						var cur_weight = modelParam.thematic_factor*importance*cur_word_dist*cur_field_factor/sum;

						var functionItem = {};
						functionItem.filter = {};
						functionItem.filter.match = {};
						functionItem.filter.match[cur_field] = cur_word;
						functionItem.weight = cur_weight;
						function_list.push(functionItem);
					}
				}
			}

			
		}
	}
	

	if(placeInfoList){
		if(modelParam.geo_factor !== 0){
			for(var url in placeInfoList){
				if(placeInfoList[url].hasOwnProperty("lat") 
					&& placeInfoList[url].hasOwnProperty("long") 
					&& placeInfoList[url].hasOwnProperty("r")){
					var r = placeInfoList[url]["r"];
					var place_lat = placeInfoList[url]["lat"];
					var place_long = placeInfoList[url]["long"];
					// var placeName = placeInfoList[url]["word"];

					
					// add the spatial kernel to the function list
					var functionItem = {
											gauss: {
												location: {
													origin: [place_long, place_lat],
													scale: `${r}km`,
													offset: `0km`,
													decay: 0.5
												}
											},
											weight: modelParam.geo_factor * placeInfoList[url]["importance"]
										};
					
					function_list.push(functionItem);
					// console.log([long, lat]);
					// console.log(functionItem);
					
				}
			}
		}

		if(modelParam.w2d_factor !== 0){
			// add the inputVec as a component of our model
			if(inputVec !== null){
				var functionItem = {
										script_score: {
											script: {
												inline: "payload_vector_score",
												lang: "native",
												params: {
														field: "doc2vec",
														vector: inputVec,
														cosine : true
												}
											}
										},
										weight: modelParam.w2d_factor
									};
				function_list.push(functionItem);
			}else{
				queryBoost += modelParam.w2d_factor;
			}
			
		}

		if(modelParam.geo_enrich_factor !== 0){
			// add the place name as a phrase to be matched in the description
			var geo_enrich_obj = geo_enrich_place_factor_constructor(placeInfoList);
			for(var i = 0; i < fieldList.length; i++){
				var cur_field = fieldList[i];
				var cur_field_factor = modelParam.geo_enrich_field_factor[cur_field];

				if(cur_field_factor !== 0){
					for(var placeName in geo_enrich_obj){
						var place_factor = geo_enrich_obj[placeName];

						var functionItem = {};
						functionItem.filter = {};
						functionItem.filter.match = {};
						functionItem.filter.match[cur_field] = placeName;
						functionItem.weight = modelParam.geo_enrich_factor * cur_field_factor * place_factor;
						function_list.push(functionItem);
						// console.log(functionItem.filter.match_phrase[cur_field]);

						var shouldItem = {};
						shouldItem.match = {};
						shouldItem.match[cur_field] = placeName;
						shouldList.push(shouldItem);

					}
				}
				
			}
		}
		
		

		
	}

	// if we have the user's location, we can rerank the result to put extra interests to the items which is close to the user
	// if(lat !== null && lon !== null){
	// 	var functionItem = {
	// 							gauss: {
	// 								location: {
	// 									origin: [lon, lat],
	// 									scale: `20km`,
	// 									offset: `0km`,
	// 									decay: 0.5
	// 								}
	// 							},
	// 							weight: modelParam.location_factor
	// 						};
		
	// 	function_list.push(functionItem);
	// }

	// console.log(function_list);
	
	return {"shouldList": shouldList, "function_list":function_list};

}

function geo_enrich_place_factor_constructor(placeInfoList){
	var geo_enrich_obj = {};
	for(var url in placeInfoList){
		var cur_imp = placeInfoList[url]["importance"];
		var cur_place = url.replace("http://dbpedia.org/resource/", "");
		if(placeInfoList[url].hasOwnProperty("label")){
			var cur_place = placeInfoList[url]["label"];
		}
		
		if(placeInfoList[url].hasOwnProperty("enrichPlace")){
			geo_enrich_place_factor_add(geo_enrich_obj, cur_place, cur_imp/2.0);
			// geo_enrich_obj[cur_place] = cur_imp/2.0;
			var numOfEnrichPlace = Object.keys(placeInfoList[url]["enrichPlace"]).length;

			for(var enrich_url in placeInfoList[url]["enrichPlace"]){
				var enrich_label = placeInfoList[url]["enrichPlace"][enrich_url];
				geo_enrich_place_factor_add(geo_enrich_obj, enrich_label, cur_imp/(2.0*numOfEnrichPlace));
				// geo_enrich_obj[enrich_label] = cur_imp/(2.0*numOfEnrichPlace);
			}
			

		}else{
			geo_enrich_place_factor_add(geo_enrich_obj, cur_place, cur_imp);
			// geo_enrich_obj[cur_place] = cur_imp;
		}
	}

	return geo_enrich_obj;
}

function geo_enrich_place_factor_add(geo_enrich_obj, placeName, factor){
	if(geo_enrich_obj.hasOwnProperty(placeName)){
		geo_enrich_obj[placeName] += factor;
	}else{
		geo_enrich_obj[placeName] = factor;
	}
}


// function getShouldQuery(modelParam, searchKeywordList, placeInfoList, inputVec, numOfConcept){
// 	var shouldList = [];
// 	// var mustList = [];
// 	var function_list = [];

// 	var fieldList = ["title", "description", "snippet"];
// 	// var field_factor_List = [1.0, 0.5, 0.5];
// 	// for(var k = 0; k < searchKeywordList.length; k++){
// 	// 	var cur_wordList = searchKeywordList[k];
// 	// 	var shouldObj = {bool: {should: []}};
		
// 	// 	for(var i = 0; i < fieldList.length; i++){
// 	// 		var cur_field = fieldList[i];
// 	// 		var cur_field_factor = field_factor_List[i];

// 	// 		for(var j = 0; j < cur_wordList.length; j++){
// 	// 			var cur_word = cur_wordList[j].word;
// 	// 			var cur_word_dist = cur_wordList[j].dist;

// 	// 			// shouldList.push({ match: { cur_field: cur_word}});
// 	// 			var shouldItem = {};
// 	// 			shouldItem.match = {};
// 	// 			shouldItem.match[cur_field] = cur_word;
// 	// 			shouldObj.bool.should.push(shouldItem);

				

// 	// 			// According to the current field name and the similarity between the user's input word and current word (the value given by word2vec)
// 	// 			// We assign weight for each filter
// 	// 			var cur_weight = cur_field_factor*cur_word_dist;

// 	// 			// function_list.push({
// 	// 			// 						filter: { match: { cur_field: cur_word } },
// 	// 			// 						weight: cur_weight
// 	// 			// 				});
// 	// 			var functionItem = {};
// 	// 			functionItem.filter = {};
// 	// 			functionItem.filter.match = {};
// 	// 			functionItem.filter.match[cur_field] = cur_word;
// 	// 			functionItem.weight = cur_weight;
// 	// 			function_list.push(functionItem);
// 	// 		}
// 	// 	}
// 	// 	mustList.push(shouldObj);
// 	// }






// 	for(var i = 0; i < fieldList.length; i++){
// 		var cur_field = fieldList[i];
// 		var cur_field_factor = modelParam.thematic_field_factor[cur_field];

// 		for(var j = 0; j < searchKeywordList.length; j++){
// 			var cur_word = searchKeywordList[j].word;
// 			var cur_word_dist = searchKeywordList[j].dist;

// 			// shouldList.push({ match: { cur_field: cur_word}});
// 			var shouldItem = {};
// 			shouldItem.match = {};
// 			shouldItem.match[cur_field] = cur_word;
// 			shouldList.push(shouldItem);

			

// 			// According to the current field name and the similarity between the user's input word and current word (the value given by word2vec)
// 			// We assign weight for each filter
// 			// cur_word_dist: (the sim_score between the word and original word) * (The importance score of original word)
// 			// cur_field_factor: the current field factor
// 			// modelParam.thematic_factor: the themantic total weight
// 			var cur_weight = modelParam.thematic_factor*cur_field_factor*cur_word_dist;

// 			// function_list.push({
// 			// 						filter: { match: { cur_field: cur_word } },
// 			// 						weight: cur_weight
// 			// 				});
// 			var functionItem = {};
// 			functionItem.filter = {};
// 			functionItem.filter.match = {};
// 			functionItem.filter.match[cur_field] = cur_word;
// 			functionItem.weight = cur_weight;
// 			function_list.push(functionItem);
// 		}
// 	}

// 	if(placeInfoList){ 
// 		for(var url in placeInfoList){
// 			var r = placeInfoList[url]["r"];
// 			var lat = placeInfoList[url]["lat"];
// 			var long = placeInfoList[url]["long"];
// 			var placeName = placeInfoList[url]["word"];

// 			// add the spatial kernel to the function list
// 			var functionItem = {
// 									gauss: {
// 										location: {
// 											origin: [long, lat],
// 											scale: `${r}km`,
// 											offset: `${r}km`
// 										}
// 									},
// 									weight: modelParam.geo_factor * placeInfoList[url]["importance"]
// 								};
// 			// functionItem.gauss = {};
// 			// functionItem.gauss.location = {};
// 			// functionItem.gauss.location.origin = [long, lat];
// 			// functionItem.gauss.location.scale = `${r}km`;
// 			// functionItem.gauss.location.offset = `${r}km`;
// 			function_list.push(functionItem);
// 			// console.log([long, lat]);
// 			console.log(functionItem);

// 			// add the place name as a phrase to be matched in the description
// 			// var functionItem = {};
// 			// functionItem.filter = {};
// 			// functionItem.filter.match_phrase = {};
// 			// functionItem.filter.match_phrase[cur_field] = placeName.toLowerCase();
// 			// functionItem.weight = 1.0/numOfConcept;
// 			// function_list.push(functionItem);
// 			// console.log(functionItem.filter.match_phrase[cur_field]);

// 			// add the inputVec as a component of our model
// 			var functionItem = {
// 									script_score: {
// 										script: {
// 											inline: "payload_vector_score",
// 											lang: "native",
// 											params: {
// 													field: "doc2vec",
// 													vector: inputVec,
// 													cosine : true
// 											}
// 										}
// 									},
// 									weight: modelParam.w2d_factor
// 								};
// 			function_list.push(functionItem);


			
// 		}
// 	}

// 	console.log(function_list);
	
// 	return {"shouldList": shouldList, "function_list":function_list};

// }




// search(function(response){
// 	console.log(response);
// });

module.exports = {  
	search: search,
	elasticsearch: elasticsearch
};