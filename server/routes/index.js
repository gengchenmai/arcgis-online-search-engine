const express = require('express');
var router = express.Router();

const fs = require("fs");
const path = require('path');
const w2v = require( 'word2vec');
// const stopword = require('stopword');
// const lemmer = require('lemmer');


var PythonShell = require("python-shell");

var search = require("./semantic_search.js");

var dbpedia_nlp = require("./dbpedia_nlp.js");

var w2v_vocab_jsonFile = path.join(__dirname, '../data/glove.6B.100d.vocab.json');

/* Define the parameter we use in the model ---- begin*/
// var modelParam = {};
// // TF-IDF weighted Word2Vec coeff: Each doc has TF-IDF weighted Word2Vec, this similarity score based on cosine similarity between doc vector and query vector
// modelParam.w2d_factor = 0.2;
// // Spatial distance factor coeff: The spatial gauss kernel, the center of the kernels is obtained from Place Name Recognize
// modelParam.geo_factor = 0.2;
// // Geographic term factor coeff: Using place hierarchy to expand the geographic name
// modelParam.geo_enrich_factor = 0.1;
// // Geographic term factor of field coeff: the different factor given to different fields
// modelParam.geo_enrich_field_factor = {
// 	title: 0.5,
// 	description: 0.25,
// 	snippet: 0.25
// };
// // Word2Vec factor coeff: themantic terms query expansion
// modelParam.thematic_factor = 0.5;
// // Word2Vec factor of field coeff: the different factor given to different fields
// modelParam.thematic_field_factor = {
// 	title: 0.5,
// 	description: 0.25,
// 	snippet: 0.25
// };

var modelParam = {
	// Word2Vec factor coeff: themantic terms query expansion
	thematic_factor:0.5,
	// Word2Vec factor of field coeff: the different factor given to different fields
	thematic_field_factor: {
		title: 0.5,
		description: 0.25,
		snippet: 0.25
	},
	// Spatial distance factor coeff: The spatial gauss kernel, the center of the kernels is obtained from Place Name Recognize
	geo_factor: 0.2,
	// TF-IDF weighted Word2Vec coeff: Each doc has TF-IDF weighted Word2Vec, this similarity score based on cosine similarity between doc vector and query vector
	w2d_factor: 0.2,
	// Geographic term factor coeff: Using place hierarchy to expand the geographic name
	geo_enrich_factor: 0.1,
	// Geographic term factor of field coeff: the different factor given to different fields
	geo_enrich_field_factor: {
		title: 0.5,
		description: 0.25,
		snippet: 0.25
	}
	// location_factor: 0
};

// var modelParam = {
// 	// Word2Vec factor coeff: themantic terms query expansion
// 	thematic_factor:0.1103,
// 	// Word2Vec factor of field coeff: the different factor given to different fields
// 	thematic_field_factor: {
// 		title: 0.5,
// 		description: 0.25,
// 		snippet: 0.25
// 	},
// 	// Spatial distance factor coeff: The spatial gauss kernel, the center of the kernels is obtained from Place Name Recognize
// 	geo_factor: 0.2439,
// 	// TF-IDF weighted Word2Vec coeff: Each doc has TF-IDF weighted Word2Vec, this similarity score based on cosine similarity between doc vector and query vector
// 	w2d_factor: 0.4388,
// 	// Geographic term factor coeff: Using place hierarchy to expand the geographic name
// 	geo_enrich_factor: 0.7693,
// 	// Geographic term factor of field coeff: the different factor given to different fields
// 	geo_enrich_field_factor: {
// 		title: 0.5,
// 		description: 0.25,
// 		snippet: 0.25
// 	}
// };

/* Define the parameter we use in the model ---- finish*/




// var buildMapItemDict = function(simple_json_data){
// 	let mapItemDict = {};
// 	for(let i = 0; i < simple_json_data.length; i++){
// 		let id = simple_json_data[i].id;
// 		mapItemDict[id] = i;
// 	}

// 	return mapItemDict;
// }

// var mapItemDict = buildMapItemDict(simple_json_data);

var buildArcGISItemTypeDict = function(){
	var arcgisItemTypeFilePath = path.join(__dirname, "../data/arcgis-item-classification.txt")
	var arcgisTypeDict = {};
	var contents = fs.readFileSync(arcgisItemTypeFilePath).toString();
	var lines = contents.split("\r\n");
	// console.log(lines);
	for(var i = 0; i < lines.length; i++){
		var itemTuple = lines[i].split("\t");
		arcgisTypeDict[itemTuple[1]] = itemTuple[0];
	}
	return arcgisTypeDict;
}

var arcgisTypeDict = buildArcGISItemTypeDict();

// load the word2vec model
var w2v_model = {};
// '../data/arcgis_online_w2v.txt'
w2v.loadModel( path.join(__dirname, '../data/glove.6B.100d.txt'), function( error, model ) {
	console.log( model );
	w2v_model = model;
});

// load Word2Vec vocabulary
var w2v_vocab = {};

fs.readFile(w2v_vocab_jsonFile, 'utf8', function (err, data) {
    if (err) {
       // error handling
        console.log(err);
    }
 
    w2v_vocab = JSON.parse(data);
    console.log("Read Word2Vec vocabulary finsihed!");
});


/* GET home page. */
const P_DIST = path.join(__dirname, "../../client/");

router.use("/lib", express.static(P_DIST + "/libraries"));
router.use("/img", express.static(P_DIST + "/images"));
router.use("/js", express.static(P_DIST + "/javascripts"));
router.use("/css", express.static(P_DIST + "/stylesheets"));

router.get('/', (req, res, next) => {
	res.sendFile(P_DIST + "views/index.html");
});


router.get('/type_dict', (req, res, next) => {
	// return res.json(JSON.stringify(arcgisTypeDict));
	return res.json(arcgisTypeDict);
});


// this API will use the TF-IDF weighted word2vec of each map item
// It simply combines the word vectors of the user input words
// router.get('/simple_w2d', (req, res, next) => {
// 	var inputSearchText = req.query.text;
// 	var topn = req.query.topn;
// 	var options = {
// 		mode: 'text',
// 		pythonPath: '/usr/bin/python2.7',
// 		// pythonOptions: ['-u'],
// 		scriptPath:path.join(__dirname, "../models/"),
// 		args: [inputSearchText, topn]
// 	};

// 	PythonShell.run('w2d_tf_idf_simple.py', options, function (err, results) {
// 		if (err) throw err;
// 		// results is an array consisting of messages collected during execution
// 		// console.log('results: %j', results);
		
// 		console.log(JSON.parse(results));

// 		let rawJSON = JSON.parse(results);
// 		let resultJSON= [];
// 		for(let i = 0; i < rawJSON.length-1; i++){
// 			let id = rawJSON[i][0];
			
// 			let dist = rawJSON[i][1];
// 			let cur_jsonitem = simple_json_data[mapItemDict[id]];

// 			// cur_jsonitem["dist"] = dist;
// 			// console.log(cur_jsonitem.id);
// 			// console.log(cur_jsonitem.title);
// 			cur_jsonitem.dist = dist;
// 			resultJSON.push(cur_jsonitem);
// 		}

// 		// console.log(resultJSON);


// 		return res.json(resultJSON);
// 	});
// });

// using the default Elasticsearch to find similar map items
router.get('/elasticsearch', (req, res, next) => {
	res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE'); // If needed
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,contenttype'); // If needed
    res.setHeader('Access-Control-Allow-Credentials', true); // If needed

    var inputSearchText = req.query.text;
    var topn = parseInt(req.query.topn);

    console.log(inputSearchText);

    if(inputSearchText === ""){
		return null;
	}else{
		search.elasticsearch(inputSearchText, topn, function(response){
			// console.log(response);
			var resultJsonObj = {};
			// resultJsonObj.placeNERresult = placeNERresult;
			resultJsonObj.hits = response;
			// resultJsonObj.modelParam = cur_modelParam;
			resultJsonObj.searchText = inputSearchText;
			return res.json(resultJsonObj);
		});
	}
});

// using Elasticsearch to find similar map items
router.get('/search', (req, res, next) => {
	res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE'); // If needed
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,contenttype'); // If needed
    res.setHeader('Access-Control-Allow-Credentials', true); // If needed


	var inputSearchText = req.query.text;
	var topn = parseInt(req.query.topn);
	var doNER = parseInt(req.query.doNER);

	

	var cur_modelParam = modelParam;

	if(req.query.hasOwnProperty("modelParam")){
		cur_modelParam = req.query.modelParam;
		console.log(cur_modelParam);

		cur_modelParam = modelParamRead(cur_modelParam);
	}

	var user_lat = null;
	var user_lon = null;

	if(req.query.hasOwnProperty("lat") && req.query.hasOwnProperty("lon")){
		if(!isNaN(req.query.lat) && !isNaN(req.query.lon)){
			user_lat = parseFloat(req.query.lat);
			user_lon = parseFloat(req.query.lon);

			// cur_modelParam.location_factor = 0.1

		}

	}
	

	

	if(inputSearchText === ""){
		return null;
	}else{
		if(doNER == 1){
			dbpedia_nlp.placeNameRecognition(inputSearchText, user_lat, user_lon, function(placeInfoObj){
				// console.log(placeInfoObj);
				var placeInfoList = placeInfoObj.placeInfoList;
				var placeNERresult = placeInfoObj.placeNERresult;
				// console.log(placeInfoList);

				var resultText = placeNR_post_process(placeInfoList, inputSearchText);
				console.log(resultText);

				var options = {
					mode: 'text',
					pythonPath: '/usr/bin/python3.5',
					// pythonOptions: ['-u'],
					scriptPath:path.join(__dirname, "../models/"),
					args: [resultText, topn]
				};

				PythonShell.run('nltk_preprocess_searchText.py', options, function (err, results) {
					if (err) throw err;
					// results is an array consisting of messages collected during execution
					// console.log('results: %j', results);
					
					// var tokenList = results[0].split(" ");
					// if(placeInfoList === null){
					// 	var numOfPlace = 0;
					// }else{
					// 	var numOfPlace = Object.keys(placeInfoList).length;
					// }
					
					// console.log(numOfPlace);

					if(cur_modelParam.w2d_factor === 0 && cur_modelParam.thematic_factor === 0){
						var resultParam = {
							inputVec: null,
							searchKeywordObj: null,
							numOfConcept: 0
						};
					}
					else{
						var resultParam = searchKeywordObj_Constractor(results);
					}

					var inputVec = resultParam.inputVec;
					
					// console.log(searchKeywordObj);

					// dbpedia_nlp.getsearchKeyWordList(resultParam.searchKeywordObj, placeInfoList, function(searchKeywordList){
					// 	console.log(searchKeywordList);
						search.search(cur_modelParam, resultParam.searchKeywordObj, placeInfoList, inputVec, resultParam.numOfConcept, topn, function(response){
							// console.log(response);
							var resultJsonObj = {};
							resultJsonObj.placeNERresult = placeNERresult;
							resultJsonObj.hits = response;
							resultJsonObj.modelParam = cur_modelParam;
							resultJsonObj.searchText = inputSearchText;
							return res.json(resultJsonObj);
						});
					// });
					
				});
			});
		}else if(doNER == 0){
			var options = {
				mode: 'text',
				pythonPath: '/usr/bin/python3.5',
				// pythonOptions: ['-u'],
				scriptPath:path.join(__dirname, "../models/"),
				args: [inputSearchText, topn]
			};
			PythonShell.run('nltk_preprocess_searchText.py', options, function (err, results) {
				if (err) throw err;
				// results is an array consisting of messages collected during execution
				// console.log('results: %j', results);
				if(cur_modelParam.w2d_factor === 0 && cur_modelParam.thematic_factor === 0){
					var resultParam = {
						inputVec: null,
						searchKeywordObj: null,
						numOfConcept: 0
					};
				}
				else{
					var resultParam = searchKeywordObj_Constractor(results);
				}
				

				var inputVec = resultParam.inputVec;
				// console.log(searchKeywordObj);

				// dbpedia_nlp.getsearchKeyWordList(resultParam.searchKeywordObj, null, function(searchKeywordList){
				// 	console.log(searchKeywordList);
					search.search(cur_modelParam, resultParam.searchKeywordObj, null, inputVec, resultParam.numOfConcept, topn, function(response){
						// console.log(response);
						var resultJsonObj = {};
						resultJsonObj.placeNERresult = null;
						resultJsonObj.hits = response;
						resultJsonObj.modelParam = cur_modelParam;
						resultJsonObj.searchText = inputSearchText;
						return res.json(resultJsonObj);
					});
				// });

				// var searchKeywordList = dbpedia_nlp.getsearchKeyWordList(searchKeywordObj, placeInfoList);
				// console.log(searchKeywordList);

				// search.search(searchKeywordList, null, function(response){
				// 	// console.log(response);
				// 	return res.json(response);
				// });

			});
		}else{
			return null;
		}
		
	}

});



// function textPreprocessing(inputSearchText, fk_preprocess){
// 	var decrip = inputSearchText.replace(/http[s]?:\/\/(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/g, '');
// 	decrip = decrip.replace(/[^a-zA-Z_ ]/g, '');

// 	var str_list = stopword.removeStopwords(decrip);
// 	var new_list = str_list.map(function(x) {
// 		return x.toLowerCase();
// 	});
// 	// for(var i = 0; i < new_str.length; i++){
// 	// 	var token = new_str[i].toLowerCase();
// 	// }
// 	var jsonData = {};
// 	Lemmer.lemmatize(new_list, function(err, words){
// 		console.log(words); // ['go','and','buy']
// 		for(var i = 0; i < words.length; i++){
// 			jsonData[str_list[i]] = words[i];
// 		}
// 		fk_preprocess(jsonData);
// 	});
// }

function modelParamRead(cur_modelParam){
	var new_modelParam = {
		// Word2Vec factor coeff: themantic terms query expansion
		thematic_factor: parseFloat(cur_modelParam.thematic_factor),
		// Word2Vec factor of field coeff: the different factor given to different fields
		thematic_field_factor: {
			title: parseFloat(cur_modelParam.thematic_field_factor.title),
			description: parseFloat(cur_modelParam.thematic_field_factor.description),
			snippet: parseFloat(cur_modelParam.thematic_field_factor.snippet)
		},
		// Spatial distance factor coeff: The spatial gauss kernel, the center of the kernels is obtained from Place Name Recognize
		geo_factor: parseFloat(cur_modelParam.geo_factor),
		// TF-IDF weighted Word2Vec coeff: Each doc has TF-IDF weighted Word2Vec, this similarity score based on cosine similarity between doc vector and query vector
		w2d_factor: parseFloat(cur_modelParam.w2d_factor),
		// Geographic term factor coeff: Using place hierarchy to expand the geographic name
		geo_enrich_factor: parseFloat(cur_modelParam.geo_enrich_factor),
		// Geographic term factor of field coeff: the different factor given to different fields
		geo_enrich_field_factor: {
			title: parseFloat(cur_modelParam.geo_enrich_field_factor.title),
			description: parseFloat(cur_modelParam.geo_enrich_field_factor.description),
			snippet: parseFloat(cur_modelParam.geo_enrich_field_factor.snippet)
		}
	};

	return new_modelParam;

}

function placeNR_post_process(placeInfoList, inputSearchText){
	var resultText = inputSearchText;
	for(var url in placeInfoList){
		// console.log(url);
		if(placeInfoList[url].hasOwnProperty("word")){
			var placeName = placeInfoList[url]["word"];
			// var placeName_replace = placeName.replace(" ", "_");
			// resultText = resultText.replace(placeName, placeName_replace);

			resultText = resultText.replace(placeName, "");
			// console.log(resultText);
		}
	}

	return resultText;

}

function searchKeywordObj_Constractor(results){
	var tokenDict = JSON.parse(results);
	// console.log(tokenDict);
	var searchKeywordObj = {};

	// the toke importance means how much this token can capture the user's interntion
	var tokenImportanceList = [];
	var keyList = Object.keys(tokenDict);
	var numOfConcept = keyList.length;
	for(var i = 0; i < keyList.length; i++){
		tokenImportanceList.push(1.0/numOfConcept);
	}
	
	// we need to get the vector from input text by adding all the vectors of the tokens up
	var inputVec = null;

	for(var i = 0; i < keyList.length; i++){
		var key = keyList[i];
		var token = tokenDict[key];
		// console.log(`i: ${i}\tkey: ${key}\tvalue: ${tokenDict[key]}`);

		// compute vector of input text
		if(w2v_vocab.indexOf(token) !== -1){
			var cur_vec = w2v_model.getVector(token);
			if(inputVec === null){
				inputVec = cur_vec;
			}else{
				inputVec = inputVec.add(cur_vec);
			}
		}
		
		
		// console.log(cur_vec.word);
		// console.log(cur_vec.values);
		
		

		var simWord = w2v_model.mostSimilar(token, 10);
		var currentTuple = { "word": token, "dist": 1.0 };
		// console.log(simWord);
		// console.log(simWord);
		if(simWord){
			simWord.unshift(currentTuple);
		}else{
			simWord = [currentTuple];
		}
		
		// var currentKeywordList = [];
		// currentKeywordList.push(curentTuple);
		// currentKeywordList.concat(simWord);
		// searchKeywordList.push(simWord);
		// searchKeywordList = searchKeywordList.concat(simWord);
		searchKeywordObj[token] = {};
		searchKeywordObj[token]["importance"] = tokenImportanceList[i];
		searchKeywordObj[token]["w2v"] = simWord;
		searchKeywordObj[token]["origin"] = key;
	}

	var inputVec_Value = inputVec === null ? null : inputVec.values;

	// console.log(inputVec.values);
	return {searchKeywordObj: searchKeywordObj, numOfConcept: numOfConcept, inputVec: inputVec_Value};
}

module.exports = router;
