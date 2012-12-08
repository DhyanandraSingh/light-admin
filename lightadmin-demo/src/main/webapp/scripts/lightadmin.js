(function($) {
$.fn.serializeFormJSON = function() {
var o = {};
var a = this.serializeArray();
$.each(a, function() {
	   if (o[this.name]) {
		   if (!o[this.name].push) {
			   o[this.name] = [o[this.name]];
		   }
		   o[this.name].push(this.value || '');
	   } else {
		   o[this.name] = this.value || '';
	   }
});
return o;
};
})(jQuery);

function dataTableRESTAdapter( sSource, aoData, fnCallback ) {

	//extract name/value pairs into a simpler map for use later
	var paramMap = {};
	for ( var i = 0; i < aoData.length; i++ ) {
		paramMap[aoData[i].name] = aoData[i].value;
	}

	//page calculations
	var pageSize = paramMap.iDisplayLength;
	var start = paramMap.iDisplayStart;
	var pageNum = (start == 0) ? 1 : (start / pageSize) + 1; // pageNum is 1 based

	// extract sort information
	var sortCol = paramMap.iSortCol_0;
	var sortDir = paramMap.sSortDir_0;
	var sortName = paramMap['mDataProp_' + sortCol];

	//create new json structure for parameters for REST request
	var restParams = new Array();
	restParams.push( {"name":"limit", "value":pageSize} );
	restParams.push( {"name":"page", "value":pageNum } );
	restParams.push( { "name":"sort", "value":sortName } );
	restParams.push( { "name":sortName + ".dir", "value":sortDir } );

	jQuery.ajax( {
					"dataType":'json',
					"type":"GET",
					"url":sSource,
					"data":restParams,
					"success":function ( data ) {
						data.iTotalRecords = data.page.totalElements;
						data.iTotalDisplayRecords = data.page.totalElements;

						fnCallback( data );
					}
				} );
}

function renderValue( value ) {
	var strValue = extractStrValue(value);

	strValue = strValue == '' ? '&nbsp;' : strValue;

	if ( value['links'] !== undefined ) {
		var restEntityUrl = value.links[1].href;

		return "<a href='" + restEntityUrl + "'>" + strValue + "</a>";
	}

	return strValue;
}

function extractStrValue( dataValue ) {
	if ( dataValue instanceof Array ) {
		var items = '';
		for (var arrayIndex in dataValue) {
			var arrayItem = dataValue[arrayIndex];
			if ( arrayItem['stringRepresentation'] !== undefined) {
				items += arrayItem['stringRepresentation'] + '<br/>';
			}
		}
		return items;
	}

	if (typeof dataValue === 'object' && dataValue['stringRepresentation'] !== undefined) {
		return dataValue['stringRepresentation'];
	}

	return dataValue;
}

function getPrimaryKey( dataValue ) {
	for (var prop in dataValue) {
		if ((dataValue[prop]['primaryKey'] !== undefined) && (dataValue[prop]['primaryKey'] == true)) {
			return dataValue[prop]['value'];
		}
	}
	return null;
}

function quickLook( aData ) {
	var primaryKey = getPrimaryKey( aData );

	var detailsHtmlBlock = '<div id="quickView-' + primaryKey + '" class="innerDetails"><dl class="dl-horizontal">';

	for (var prop in aData) {
		if ( prop != 'links' && prop != 'stringRepresentation') {
			var name = aData[prop]['name'] !== undefined ? aData[prop]['name'] : prop;
			var value = aData[prop]['value'] !== undefined ? aData[prop]['value'] : aData[prop];

			detailsHtmlBlock += '<dt>' + name + '</dt><dd>' + renderValue(value) + '</dd>';
		}
	}
	detailsHtmlBlock += '</dl></div>';

	return detailsHtmlBlock;
}

/* Add event listener for opening and closing details
 * Note that the indicator for showing which row is open is not controlled by DataTables,
 * rather it is done here
 */
function bindInfoClickHandlers( tableElement, dataTable ) {
	$( 'tbody td img', $(tableElement) ).live( 'click', function () {
		var infoImg = $( this );
		var nTr = infoImg.parents( 'tr' )[0];
		if ( dataTable.fnIsOpen( nTr ) ) {
			$('div.innerDetails', $(nTr).next()[0]).slideUp('slow', function () {
				dataTable.fnClose( nTr );
				infoImg.attr('src', "../images/details_open.png");
				infoImg.attr('title', "Click to show Info");
			});
		} else {
			var aData = dataTable.fnGetData( nTr );
			var restEntityUrl = aData.links[0].href;
			jQuery.ajax( {
				"dataType" : 'json',
				"type" : "GET",
				"url" : restEntityUrl,
				"success":function ( data ) {
					var nDetailsRow = dataTable.fnOpen( nTr, quickLook( data ), 'details' );
					$('div.innerDetails', nDetailsRow).hide();
					$('div.innerDetails', nDetailsRow).slideDown('slow', function () {
						infoImg.attr('src', "../images/details_close.png");
						infoImg.attr('title', "Click to hide Info");
					});
				}
			} );
		}
	} );
}

function loadDomainObjectForShowView(showViewSection, restRepoUrl) {
	$.ajax({
			   type: 'GET',
			   url: restRepoUrl,
			   dataType : 'json',
			   success : function(data) {
				   for (name in data) {
					   var field = showViewSection.find('[name="field-' + name + '"]');
					   if (field.length > 0) {
						   if ($.isPlainObject(data[name].value)) {
							   field.html(renderValue(data[name].value));
						   } else {
							   field.html(data[name].value);
						   }
					   }
				   }
			   }
		   });
}

var REST_REPO_URL;

function loadDomainObject(form, restRepoUrl) {
	REST_REPO_URL = restRepoUrl;
	$.ajax({
		type: 'GET',
		url: restRepoUrl,
		dataType : 'json',
		success : function(data, textStatus) {
			for (name in data) {
				var editor = form.find('[name="' + name + '"]');
				if (editor.length > 0) {
					if ($.isPlainObject(data[name].value)) {
						editor.val(data[name].value.stringRepresentation);
					} else {
						editor.val(data[name].value);
					}
				}
			}
		}
	});
}

function updateDomainObject(domForm) {

	var jsonForm = $(domForm).serializeFormJSON();
	$.ajax({
		type: 'PUT',
		url: REST_REPO_URL + '?returnBody=true',
		contentType: 'application/json',
		data: JSON.stringify(jsonForm),
		dataType : 'json',
		success : function(data, textStatus) {
			var link = $.grep(data.links, function(link) {
				return link.rel == 'selfDomainLink';
			})[0];
			window.location = link.href;
		},
		statusCode : {
			400 /* BAD_REQUEST */:
				function(jqXHR) {
					var data = $.parseJSON(jqXHR.responseText);
					var errors = data.errors;
					for (var i=0; i<errors.length; i++) {
						var error = errors[i];
						var messageDiv = $('#' + error.field + '-error');
						if (messageDiv.length > 0) {
							messageDiv.text(error.message);
						}
						var controlGroup = $('#' + error.field + '-control-group');
						if (controlGroup.length > 0) {
							controlGroup.addClass('error');
						}
					}
				}
		}
	});

	return false;
}
