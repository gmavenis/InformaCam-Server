var InformaLocationMarker = function(coords, text) {
	this.lat = coords[0];
	this.lng = coords[1];
	this.text = text;
	this.label = "[" + coords[0] + ", " + coords[1] + "]";

	markerData = '<span id="markerLat" class="locationMarkerData">' + this.lat + '</span>' + '<span id="markerLng" class="locationMarkerData">' + this.lng + '</span>';

	this.build = function() {

		var a = locationMarker = $(document.createElement('a'))
			.html(this.label + markerData)
			.attr('class','informaLocationMarker')
			.live('click', function() {
				lat = $("#markerLat").html();
				lng = $("#markerLng").html();
				text = lat + ', ' + lng;
				zoomOnMap(lat, lng, null, null, text, mapViewMap);
				google.maps.event.trigger(mapViewMap, 'resize');
			});
		return a;
	};
};

var InformaRegion = function(left, top, right, bottom, discussionId, isNew) {
	this.bounds = {
		left: left,
		top: top,
		bottom: bottom,
		right: right,
		width: Math.abs(left - right),
		height: Math.abs(top - bottom)
	};

	if(isNew)
		this.isEditable = true;
	else
		this.isEditable = currentUser._id == entity.derivative.discussions[discussionId].originatedBy ? true : false;

	this.container = $(document.createElement('div')).attr({
		'class':'mcxDiv',
		'id':'mcx_' + discussionId
	});

	if(isNew) {
		$(this.container).addClass('mcxNew');
	}

	if(this.isEditable) {
		$(this.container).addClass("mcxEditable");
		$(this.container).append(
			$(document.createElement('div'))
				.attr('class','mcxDelete')
				.click(function() {
					var r = entity.getActiveRegion($($(this).parent()));
					console.info(r);
					var opts = [
						{
							label: Alert_STR.Basic.YES,
							action: function() {
								removeAlert();
								Media.editAnnotation.init(r.discussionId, EditTypes.DELETE, entity.derivative.discussions[r.discussionId]);
							}
						},
						{
							label: Alert_STR.Basic.NO,
							action: removeAlert
						}
					];
					showAlert(Alert_STR.Region.Delete.MAIN_TITLE, Alert_STR.Region.Delete.TEXT, true, null, opts);
				})
		);
		$(this.container).append(
			$(document.createElement('div'))
				.attr('class','mcxResize')
		);
	}

	this.displayAsDeleted = function() {
		$(this.container).removeClass('mcxNew');
		$(this.container).removeClass('mcxEditable');
		$(this.container).removeClass('mcxActive');
		$(this.container).addClass('mcxDeleted');
	}

	if(!isNew && entity.derivative.discussions[discussionId].isDeleted != undefined && entity.derivative.discussions[discussionId].isDeleted == true) {
		this.displayAsDeleted();
	}

	$(this.container).click(function() {
		mcx_move = 0;
		var r = entity.getActiveRegion(this);
		$.each(entity.regions, function() {
			if($(this.container).hasClass("mcxNew"))
				$(this.container).removeClass("mcxNew");

			if(this != r) {
				this.isSelected = false;
				this.isActive = false;
			} else {
				this.isSelected = true;
				this.isActive = true;
			}
			this.update();
		});
		showAnnotationHolder();
		entity.loadAnnotation(r.discussionId);
	});

	$(this.container).mouseenter(function() {
		var r = entity.getActiveRegion(this);
		r.isSelected = true;
		r.update();
	});

	$(this.container).mouseout(function() {
		var r = entity.getActiveRegion(this);
		r.isSelected = false;
		r.update();
	});

	$("#media_overlay").before($(this.container));

	this.isNew = isNew;
	this.discussionId = discussionId;
	this.isActive = false;
	this.isSelected = false;

	this.recalculate = function(realRegion) {
		this.bounds.left = (realRegion.regionBounds.regionCoordinates.region_left * entity.displayBounds.displayWidth)/entity.imageDimensions[0];
		this.bounds.top = (realRegion.regionBounds.regionCoordinates.region_top * entity.displayBounds.displayHeight)/entity.imageDimensions[1];
		this.bounds.right = this.bounds.left + ((realRegion.regionBounds.regionDimensions.region_width * entity.displayBounds.displayWidth)/entity.imageDimensions[0]);
		this.bounds.bottom = this.bounds.top + ((realRegion.regionBounds.regionDimensions.region_height * entity.displayBounds.displayHeight)/entity.imageDimensions[1]);
		this.update();
	};

	this.update = function(trail) {
		if(this.isSelected) {
			$(this.container).addClass('selected');
		} else {
			if(!this.isActive)
				$(this.container).removeClass('selected');
		}

		if(trail != null && trail != undefined) {
			this.bounds.left = (trail.regionCoordinates.region_left * entity.displayBounds.displayWidth)/entity.imageDimensions[0];
			this.bounds.top = (trail.regionCoordinates.region_top * entity.displayBounds.displayHeight)/entity.imageDimensions[1];
			this.bounds.right = this.bounds.left + ((trail.regionDimensions.region_width * entity.displayBounds.displayWidth)/entity.imageDimensions[0]);
			this.bounds.bottom = this.bounds.top + ((trail.regionDimensions.region_height * entity.displayBounds.displayHeight)/entity.imageDimensions[1]);
		}

		$(this.container).css({
			'width' : this.bounds.width,
			'height': this.bounds.height,
			'top': this.bounds.top,
			'left': this.bounds.left,
			'margin-left': entity.margLeft,
			'margin-top': $("#media_overlay").position().top
		});

	};

	this.move = function(e) {
		this.bounds.top = (((e.clientY - media_frame.offset().top) - (2 * entity.margTop)) - (this.bounds.height/4));
		this.bounds.left = (((e.clientX - media_frame.offset().left) - (2 * entity.margLeft)) + (this.bounds.width/4));
		this.update();
	}

	this.update();
}

var MediaEntity = function(data) {
	this._id = data._id;
	this._rev = data._rev;
	
	this.regions = new Array();
	this.getActiveRegion = function(r) {
		return entity.regions[$(r).attr('id').split("mcx_")[1]];
	}

	if(data.alias == undefined)
		this.title = formatUnaliasedTitle(data.sourceId, data.mediaType);
	else
		this.title = data.alias;

	this.dateCreated = data.dateCreated;
	this.sourceId = data.sourceId;
	this.mediaType = data.mediaType;
	this.imageDimensions = [data.j3m.data.exif.imageWidth, data.j3m.data.exif.imageLength];

	this.importFlag = false;
	if(data.importFlag != undefined && data.importFlag)
		this.importFlag = true;

	this.messages = new Array();

	this.derivative = {
		dateSavedAsDerivative: data.timestampIndexed,
		representation: data.representation,
		j3m: data.j3m,
		discussions: new Array(),
		keywords: data.keywords
	}

	this.setAlias = function() {
		Media.rename.prompt();
	};

	this.refresh = function(_rev, discussions, messages) {
		entity._rev = _rev;
		entity.derivative.discussions = discussions;
		entity.messages = messages;

		if(entity.currentAnnotation != null && entity.currentAnnotation != undefined)
			entity.reloadAnnotation(entity.currentAnnotation);

		// make sure user has all the regions!
		var missingRegions = Math.abs(entity.derivative.discussions.length - entity.regions.length);
		console.info(missingRegions);
		if(missingRegions > 0) {
			var pickup = entity.derivative.discussions.length - 1;
			alert("adding a new thing from " + pickup);
			for(var mr=0; mr<missingRegions; mr++) {
				// get derivative at (len -1) + mr and add as region
				placeRegion((pickup + mr), entity.derivative.discussions[pickup + mr]);
			}
		}

		$.each(entity.regions, function(idx, item) {
			item.recalculate(entity.derivative.discussions[idx]);
			if(entity.derivative.discussions[idx].isDeleted && entity.derivative.discussions[idx].isDeleted == true) {
				item.displayAsDeleted();
			}
		});
	}

	this.newAnnotation = {
		annotations: new Array(),
		date: new Date().getTime(),
		duration: 0,
		originatedBy: currentUser._id,
		timeIn:0,
		timeOut:0,
		regionBounds: {
			regionCoordinates: {
				region_top: 0,
				region_left: 0
			},
			regionDimensions: {
				region_height: 500,
				region_width: 500
			}
		}
	};

	this.reloadAnnotation = function(annotationId) {
		$("#annotation_content").empty();
		entity.loadAnnotation(annotationId);
	};

	this.loadAnnotation = function(annotation) {
		$("#annotation_append_submit").unbind();

		var aList = $(document.createElement('ul')).attr('class','annotation_list');

		$("#annotation_content").append(aList);
		$("#annotation_append_submit").bind('click', function() {
			Media.appendToAnnotation.init(annotation);
		});
		entity.currentAnnotation = annotation;

		if(entity.derivative.discussions[annotation] != undefined) {
			var a = entity.derivative.discussions[annotation].annotations;
			if(a != undefined && a != null) {
				$.each(a, function() {
					var aListItem = $(document.createElement('li'))
						.append(
							$(document.createElement('p')).attr('class','date')
								.html(formatTimestampForHumans(this.date))
						);

					if(this.content instanceof Object) {
						$.each(formatFromXForm(this.content), function(idx, item) {
							aListItem.append(item);
						});
					} else {
						aListItem.append(
							$(document.createElement('p'))
								.html(this.content)
						);
					}
					aList.append(aListItem);
				});
			}
		}
	};

	this.loadMessages = function(messages) {
		$("#messages_content").empty();
		showMessagesHolder();
		$("#messages_append_submit").unbind();
		var mList = $(document.createElement('ul')).attr('class','messages_list');
		$.each(messages, function() {
			var mListItem = $(document.createElement('li'))
				.append(
					$(document.createElement('p')).attr('class','date')
						.html(formatTimestampForHumans(this.date))
				)
				.append(
					$(document.createElement('p')).html(this.messageContent)
				);

			if(this.fromClient == true)
				mListItem.attr('class','from_client');
			mList.append(mListItem);
		});
		$("#messages_content").append(mList);
		$("#messages_append_submit").bind('click',function() {
			Media.sendMessage.init();
		});

	};

	if(data.discussions != undefined)
		this.derivative.discussions = data.discussions;
	if(data.messages != undefined)
		this.messages = data.messages;

	this.options = new Array();

	this.options.push(
		{
			label: Menu_STR.Media.RENAME,
			action: function() {
				entity.setAlias();
			}
		}
	);

	switch(this.mediaType) {
		case MediaTypes.IMAGE:
			this.options.push(
				{
					label: Menu_STR.Media.Image.SHARE_IMAGE,
					action: function() {
						entity.shareMedia();
					}
				}
			);
			break;
		case MediaTypes.VIDEO:
			this.options.push(
				{
					label: Menu_STR.Media.Video.SHARE_VIDEO,
					action: function() {
						entity.shareMedia();
					}
				}
			);
			break;
	}

	this.options.push({
		label: Menu_STR.Media.EXPORT_METADATA,
		action: function() {
			entity.exportMetadata();
		}
	});

	this.options.push({
		label: Menu_STR.Media.VIEW_MESSAGES,
		action: function() {
			entity.loadMessages(entity.messages);
		}
	});

	this.visualize = function(type) {
		switch(type) {
			case View.NORMAL:
				toggleValue($("#metadata_readout").get(0));
				break;
			case View.MAP:
				toggleValue($("#map_view_readout").get(0));
				break;
			case View.MOTION:
				toggleValue($("#motion_view_readout").get(0));
				break;
			case View.NETWORK:
				toggleValue($("#network_view_readout").get(0));
				break;
		}
	};

	this.shareMedia = function() {
		alert("sharing media");
	};

	this.exportMetadata = function() {
		alert("exporting metadata");
	};

	this.sendMessage = function() {
		alert("view submission info");
	};

	this.location = {
		locationOnSave: data.locationOnSave,
		locations: data.location
	};

	this.informa = {
		intent: {
			label: Metadata_STR.Intent.label,
			loads: [
				[
					Metadata_STR.Intent.SUBMITTED_BY,
					this.derivative.j3m.intent.owner.publicKeyFingerprint
				],
				[
					Metadata_STR.Intent.OWNERSHIP_TYPE,
					OwnershipTypes.Names[this.derivative.j3m.intent.owner.ownershipType]
				]
			]
		},
		genealogy: {
			label: Metadata_STR.Genealogy.label,
			loads: [
				[
					Metadata_STR.Genealogy.DATE_CREATED,
					formatTimestampForHumans(this.derivative.j3m.genealogy.dateCreated)
				],
				[
					Metadata_STR.Genealogy.DATE_ACQUIRED,
					formatTimestampForHumans(this.derivative.j3m.genealogy.dateSavedAsInformaDocument)
				],
				Metadata_STR.Data.Device.label,
				[
					Metadata_STR.Data.Device.DEVICE_BLUETOOTH_NAME,
					this.derivative.j3m.genealogy.createdOnDevice.bluetoothName
				],
				[
					Metadata_STR.Data.Device.DEVICE_BLUETOOTH_ADDRESS,
					this.derivative.j3m.genealogy.createdOnDevice.bluetoothAddress
				],
				[
					Metadata_STR.Data.Device.DEVICE_IMEI,
					this.derivative.j3m.genealogy.createdOnDevice.imei
				],
				Metadata_STR.Data.Device.Integrity.label,
				[
					Metadata_STR.Data.Device.Integrity.RATING,
					100 		//TODO!
				]
			]
		}
	};

	if(this.importFlag) {
		this.informa.genealogy.loads.push(Metadata_STR.Genealogy.ChainOfCustody.label);
		this.informa.genealogy.loads.push([
					Metadata_STR.Genealogy.ChainOfCustody.IS_IMPORT,
					Misc_STR.LEARN_MORE
		]);
	}

	this.visualize(View.NORMAL);
}