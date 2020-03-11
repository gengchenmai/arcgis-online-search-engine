


$(function() {
	_STKO.readArcGISItemTypeDict();

	$("#intelligentSearchButton").on("click",function(){
		doSemanticSearch();	
	});
	
	$('#intelligentSearchField').keypress(function(event){
		var keycode = (event.keyCode ? event.keyCode : event.which);
		if(keycode == '13'){
			doSemanticSearch();	
		}
	});
	
	function doSemanticSearch()
	{
		var searchText = $("#intelligentSearchField").val().trim();
		if($(`#naivesearch_Checkbox`)[0].checked){
			_STKO.naiveSearch(searchText, _STKO.searchTOPN);
		}else{
			_STKO.semanticSearch(searchText, _STKO.searchTOPN);
		}
		
	}
});


		