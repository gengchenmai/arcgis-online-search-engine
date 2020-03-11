var _UTIL = {};

_UTIL.textWarper = function(text, substrIndex){
	let result_text = text;
	if(text !== null){
		if(text.length > 60){
			result_text = text.substring(0, substrIndex)+"...";
		}
	}
	
	return result_text;
}

