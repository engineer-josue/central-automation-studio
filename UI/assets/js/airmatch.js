/*
Central Automation v1.1.4
Updated: 1.28.4
Copyright Aaron Scott (WiFi Downunder) 2021-2023
*/

var rfEvents = [];
var noiseEvents = [];
var rfhistory = [];
var staticRadios = [];
var powerLabels = [];
var rfNeighbours = {};
var channelAPs = {};

var optimizations = {};
var currentTimestamp;

var csvDataBuild = [];
var apKey = 'AP NAME';
var bandKey = 'BAND';
var channelKey = 'CHANNEL';
var bandwidthKey = 'BANDWIDTH';
var eirpKey = 'EIRP';
var domainKey = 'RF DOMAIN';
var partitionKey = 'RF PARTITION';
var feasibleKey = 'FEASIBLE CHANNELS';

var sixChannel;
var fiveChannel;
var twoChannel;
var sixPower;
var fivePower;
var twoPower;

var labels2 = ['1', '6', '11'];
var labels5 = ['36', '40', '44', '48', '52', '56', '60', '64', '100', '104', '108', '112', '116', '120', '124', '128', '132', '136', '140', '144', '149', '153', '157', '161', '165', '169', '173', '177'];
var labels6 = ['5', '21', '37', '53', '69', '85', '101', '117', '133', '149', '165', '181', '197', '213', '229'];

var selectedDevices = {};
var deviceInfo = {};
var frozenDevices = 0;
var frozenErrors = 0;
var currentAPIndex = 0;

var apNotification;
var channelNotification;
var powerNotification;
var staticNotification;
var radarNotification;
var eventNotification;
var noiseNotification;
var neighbourNotification;
var optimizationNotification;
var runNotification;
var visualRFNotification;

var vrfBuildings = [];
var vrfFloors = [];
var vrfAPs = [];
var vrfSelectedAPs = {};
var vrfPathloss = {};
var vrfFloorplan;
var vrfFloorId;
var vrfBuildingId;
var vrfCampusId;
var vrfChannels = {};
var vrfOptimization = [];
var needChannelList = false;
var currentAP = null;
var currentFloor;
var storedAP;
var found;
const vrfLimit = 100;
const units = 'METERS';

var apImage;
const ratio = window.devicePixelRatio;

const apColors = ['#23CCEF', '#FB404B', '#FFA534', '#9368E9', '#87CB16', '#1D62F0', '#5E5E5E', '#DD4B39', '#35465c', '#e52d27', '#55acee', '#cc2127', '#1769ff', '#6188e2', '#a748ca', '#ca489f', '#48ca9a', '#95e851', '#f2f536', '#b0b0b0', '#3414b5', '#1498b5', '#b55714', '#e3e3e3', '#851919', '#196385', '#88fceb', '#cafc88'];

const VisualLocation = { Optimization: 0, Radar: 1 };
var drawingLocation;

/*  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
		Utility functions
	------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

function findAPForRadio(radiomac) {
	// Check APs for radio mac
	var foundDevice = null;
	var aps = getAPs();
	$.each(aps, function() {
		for (var i = 0, len = this.radios.length; i < len; i++) {
			if (this.radios[i]['macaddr'] === radiomac) {
				foundDevice = this;
				return false; // break  out of the for loop
			}
		}
	});

	return foundDevice;
}

/*  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
		Run Now
	------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
// Updated: 1.8.0
function airmatchRunNow() {
	runNotification = showNotification('ca-run-shoes', 'Running AirMatch...', 'bottom', 'center', 'info');

	var select = document.getElementById('modeselector');
	var runmode = select.value;
	var runModeLabel = select.options[select.selectedIndex].text;

	var settings = {
		url: getAPIURL() + '/tools/postCommand',
		method: 'POST',
		timeout: 0,
		headers: {
			'Content-Type': 'application/json',
		},
		data: JSON.stringify({
			url: localStorage.getItem('base_url') + '/airmatch/scheduler/v1/runnow?runnow_type=' + runmode,
			access_token: localStorage.getItem('access_token'),
		}),
	};

	$.ajax(settings).done(function(response, statusText, xhr) {
		//console.log("Run Now: "+ JSON.stringify(response))
		runNotification.close();
		if (response.hasOwnProperty('status')) {
			if (response.status === '503') {
				logError('Central Server Error (503): ' + response.reason + ' (/airmatch/scheduler/v1/runnow)');
				return;
			}
		}
		if (xhr.status == 200) {
			Swal.fire({
				title: 'Success',
				text: 'AirMatch was triggered to run now (' + runModeLabel + ')',
				icon: 'success',
			});
			// refresh group data to include new group
		} else {
			logError(response.status);
			Swal.fire({
				title: 'Failure',
				text: 'AirMatch was not able to be triggered to run now (' + runModeLabel + ')',
				icon: 'error',
			});
		}
	});
}

/*  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
		Pull AirMatch Data from Central
	------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
// Updated: 1.8.0
function updateAirMatchData() {
	apImage = new Image();
	apImage.src = 'assets/img/ap-icon.svg';

	$.when(tokenRefresh()).then(function() {
		apNotification = showNotification('ca-wifi', 'Obtaining APs...', 'bottom', 'center', 'info');
		$.when(getAPData(0, false)).then(function() {
			apNotification.close();
			sixChannel = Array.apply(null, new Array(labels6.length)).map(Number.prototype.valueOf, 0);
			fiveChannel = Array.apply(null, new Array(labels5.length)).map(Number.prototype.valueOf, 0);
			twoChannel = Array.apply(null, new Array(labels2.length)).map(Number.prototype.valueOf, 0);
			sixPower = [];
			fivePower = [];
			twoPower = [];

			powerLabels = [];

			getRFNeighbours();
			getEIRPDistribution();
			getChannelDistribution();

			getAirmatchOptimization();
			getStaticRadios();
			getNoiseEvents();

			getAPsForNeighbours();

			// Get VRF data
			setTimeout(getCampus, 1000, false);

			// Do we need to grab the group properties?
			var loadAirMatchEvents = localStorage.getItem('load_airmatch_events');
			if (loadAirMatchEvents === null || loadAirMatchEvents === '') {
				loadAirMatchEvents = true;
			} else {
				loadAirMatchEvents = JSON.parse(loadAirMatchEvents);
			}
			if (loadAirMatchEvents) {
				document.getElementById('rfevents-row').hidden = false;
				getRFEvents();
			} else {
				document.getElementById('rfevents-row').hidden = true;
			}
			//getAirMatchHistory();
			$('[data-toggle="tooltip"]').tooltip();
		});
	});
}

/*  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
	EIRP
------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
function getRFNeighbours() {
	neighbourNotification = showNotification('ca-duplicate', 'Getting RF Neighbours...', 'bottom', 'center', 'info');
	rfNeighbours = {};
	var settings2 = {
		url: getAPIURL() + '/tools/getCommandwHeaders',
		method: 'POST',
		timeout: 0,
		headers: {
			'Content-Type': 'application/json',
		},
		data: JSON.stringify({
			url: localStorage.getItem('base_url') + '/airmatch/telemetry/v1/nbr_pathloss_all/2.4ghz',
			access_token: localStorage.getItem('access_token'),
		}),
	};

	$.ajax(settings2).done(function(commandResults, statusText, xhr) {
		if (commandResults.hasOwnProperty('headers')) {
			updateAPILimits(JSON.parse(commandResults.headers));
		}
		if (commandResults.hasOwnProperty('status') && commandResults.status === '503') {
			logError('Central Server Error (503): ' + commandResults.reason + ' (/airmatch/telemetry/v1/nbr_pathloss_all/2.4ghz)');
			apiErrorCount++;
			return;
		} else if (commandResults.hasOwnProperty('error_code')) {
			logError(commandResults.description);
			apiErrorCount++;
			return;
		}
		var response = JSON.parse(commandResults.responseBody);
		rfNeighbours['2'] = response;

		var settings5 = {
			url: getAPIURL() + '/tools/getCommandwHeaders',
			method: 'POST',
			timeout: 0,
			headers: {
				'Content-Type': 'application/json',
			},
			data: JSON.stringify({
				url: localStorage.getItem('base_url') + '/airmatch/telemetry/v1/nbr_pathloss_all/5ghz',
				access_token: localStorage.getItem('access_token'),
			}),
		};

		$.ajax(settings5).done(function(commandResults, statusText, xhr) {
			if (commandResults.hasOwnProperty('headers')) {
				updateAPILimits(JSON.parse(commandResults.headers));
			}
			if (commandResults.hasOwnProperty('status') && commandResults.status === '503') {
				logError('Central Server Error (503): ' + commandResults.reason + ' (/airmatch/telemetry/v1/nbr_pathloss_all/5ghz)');
				apiErrorCount++;
				return;
			} else if (commandResults.hasOwnProperty('error_code')) {
				logError(commandResults.description);
				apiErrorCount++;
				return;
			}
			var response = JSON.parse(commandResults.responseBody);
			rfNeighbours['5'] = response;

			var settings6 = {
				url: getAPIURL() + '/tools/getCommandwHeaders',
				method: 'POST',
				timeout: 0,
				headers: {
					'Content-Type': 'application/json',
				},
				data: JSON.stringify({
					url: localStorage.getItem('base_url') + '/airmatch/telemetry/v1/nbr_pathloss_all/6ghz',
					access_token: localStorage.getItem('access_token'),
				}),
			};

			$.ajax(settings6).done(function(commandResults, statusText, xhr) {
				if (commandResults.hasOwnProperty('headers')) {
					updateAPILimits(JSON.parse(commandResults.headers));
				}
				if (commandResults.hasOwnProperty('status') && commandResults.status === '503') {
					logError('Central Server Error (503): ' + commandResults.reason + ' (/airmatch/telemetry/v1/nbr_pathloss_all/6ghz)');
					apiErrorCount++;
					return;
				} else if (commandResults.hasOwnProperty('error_code')) {
					logError(commandResults.description);
					apiErrorCount++;
					return;
				}
				var response = JSON.parse(commandResults.responseBody);
				rfNeighbours['6'] = response;
				//console.log(rfNeighbours);

				neighbourNotification.close();
			});
		});
	});
}

/*  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
		EIRP
	------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
function getEIRPDistribution() {
	powerNotification = showNotification('ca-chart-bar-32', 'Getting EIRP Distribution...', 'bottom', 'center', 'info');
	var settings = {
		url: getAPIURL() + '/tools/getCommandwHeaders',
		method: 'POST',
		timeout: 0,
		headers: {
			'Content-Type': 'application/json',
		},
		data: JSON.stringify({
			url: localStorage.getItem('base_url') + '/airmatch/telemetry/v1/adv_eirp_distrubution',
			access_token: localStorage.getItem('access_token'),
		}),
	};

	$.ajax(settings).done(function(commandResults, statusText, xhr) {
		if (commandResults.hasOwnProperty('headers')) {
			updateAPILimits(JSON.parse(commandResults.headers));
		}
		if (commandResults.hasOwnProperty('status') && commandResults.status === '503') {
			logError('Central Server Error (503): ' + commandResults.reason + ' (/airmatch/telemetry/v1/adv_eirp_distrubution)');
			apiErrorCount++;
			return;
		} else if (commandResults.hasOwnProperty('error_code')) {
			logError(commandResults.description);
			apiErrorCount++;
			return;
		}
		var response = JSON.parse(commandResults.responseBody);
		// Build labels and sort them
		for (let k in response['6ghz']) {
			var index = powerLabels.indexOf(k);
			if (index == -1) {
				if (k !== 'EIRP Static') powerLabels.push(k);
			}
		}
		for (let k in response['5ghz']) {
			var index = powerLabels.indexOf(k);
			if (index == -1) {
				if (k !== 'EIRP Static') powerLabels.push(k);
			}
		}
		for (let k in response['2.4ghz']) {
			var index = powerLabels.indexOf(k);
			if (index == -1) {
				if (k !== 'EIRP Static') powerLabels.push(k);
			}
		}
		powerLabels.sort(function(a, b) {
			return a - b;
		});

		// Build the series
		for (let k in response['6ghz']) {
			var index = powerLabels.indexOf(k);
			if (index != -1) {
				sixPower[index] = { meta: '6GHz', value: response['6ghz'][k] };
			}
		}
		for (let k in response['5ghz']) {
			var index = powerLabels.indexOf(k);
			if (index != -1) {
				//fivePower[index] = response['5ghz'][k];
				fivePower[index] = { meta: '5GHz', value: response['5ghz'][k] };
			}
		}
		for (let k in response['2.4ghz']) {
			var index = powerLabels.indexOf(k);
			if (index != -1) {
				twoPower[index] = { meta: '2.4GHz', value: response['2.4ghz'][k] };
			}
		}

		if (powerLabels.length > 0) {
			var data = {
				labels: powerLabels,
				series: [sixPower, fivePower, twoPower],
			};

			var options = {
				seriesBarDistance: 10,
				axisX: {
					showGrid: false,
				},
				axisY: {
					onlyInteger: true,
					offset: 30,
				},
				height: '200px',
				plugins: [Chartist.plugins.tooltip()],
			};

			var responsiveOptions = [
				[
					'screen and (max-width: 640px)',
					{
						seriesBarDistance: 10,
						axisX: {
							labelInterpolationFnc: function(value) {
								return value[0];
							},
						},
					},
				],
			];

			var eirpChart = Chartist.Bar('#eirpChart', data, options, responsiveOptions);
			eirpChart.on('draw', function(data) {
				if (data.type == 'bar') {
					data.element.animate({
						y2: {
							dur: '0.2s',
							from: data.y1,
							to: data.y2,
						},
					});
				}
			});
		}
		powerNotification.close();
	});
}

/*  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
		Channels
	------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
function getChannelDistribution() {
	channelNotification = showNotification('ca-chart-bar-32', 'Getting Channel Distribution...', 'bottom', 'center', 'info');
	channelAPs = {};
	channelAPs['2.4GHz'] = {};
	channelAPs['5GHz'] = {};
	channelAPs['6GHz'] = {};

	var settings = {
		url: getAPIURL() + '/tools/getCommandwHeaders',
		method: 'POST',
		timeout: 0,
		headers: {
			'Content-Type': 'application/json',
		},
		data: JSON.stringify({
			url: localStorage.getItem('base_url') + '/airmatch/solver/v1/radio_plan',
			access_token: localStorage.getItem('access_token'),
		}),
	};

	$.ajax(settings).done(function(commandResults, statusText, xhr) {
		if (commandResults.hasOwnProperty('headers')) {
			updateAPILimits(JSON.parse(commandResults.headers));
		}
		if (commandResults.hasOwnProperty('status') && commandResults.status === '503') {
			logError('Central Server Error (503): ' + commandResults.reason + ' (/airmatch/solver/v1/radio_plan)');
			apiErrorCount++;
			return;
		} else if (commandResults.hasOwnProperty('error_code')) {
			logError(commandResults.description);
			apiErrorCount++;
			return;
		}
		var response = JSON.parse(commandResults.responseBody);
		$.each(response, function() {
			if (this['band'] === '2.4GHz') {
				var index = labels2.indexOf(this['channel'].toString());
				if (index != -1) {
					twoChannel[index] = twoChannel[index] + 1;
				}
			}
			if (this['band'] === '5GHz') {
				var index = labels5.indexOf(this['channel'].toString());
				if (index != -1) {
					fiveChannel[index] = fiveChannel[index] + 1;
				}
			}
			if (this['band'] === '6GHz') {
				var index = labels6.indexOf(this['channel'].toString());
				if (index != -1) {
					sixChannel[index] = sixChannel[index] + 1;
				}
			}
		});

		var data2 = {
			labels: labels2,
			series: [twoChannel],
		};

		var options2 = {
			seriesBarDistance: 10,
			axisX: {
				showGrid: false,
			},
			axisY: {
				onlyInteger: true,
				offset: 30,
			},
			height: '200px',
			plugins: [Chartist.plugins.tooltip()],
		};

		var responsiveOptions2 = [
			[
				'screen and (max-width: 640px)',
				{
					seriesBarDistance: 5,
					axisX: {
						labelInterpolationFnc: function(value) {
							return value[0];
						},
					},
				},
			],
		];
		var twoGChart = Chartist.Bar('#channelChart2GHz', data2, options2, responsiveOptions2);
		twoGChart.on('draw', function(data) {
			if (data.type == 'bar') {
				data.element.animate({
					y2: {
						dur: '0.2s',
						from: data.y1,
						to: data.y2,
					},
				});
			}
		});

		var data5 = {
			labels: labels5,
			series: [fiveChannel],
		};

		var options5 = {
			seriesBarDistance: 10,
			axisX: {
				showGrid: false,
			},
			axisY: {
				onlyInteger: true,
				offset: 30,
			},
			height: '200px',
			plugins: [Chartist.plugins.tooltip()],
		};

		var responsiveOptions5 = [
			[
				'screen and (max-width: 640px)',
				{
					seriesBarDistance: 5,
					axisX: {
						labelInterpolationFnc: function(value) {
							return value[0];
						},
					},
				},
			],
		];
		var fiveGChart = Chartist.Bar('#channelChart5GHz', data5, options5, responsiveOptions5);
		fiveGChart.on('draw', function(data) {
			if (data.type == 'bar') {
				data.element.animate({
					y2: {
						dur: '0.2s',
						from: data.y1,
						to: data.y2,
					},
				});
			}
		});

		var data6 = {
			labels: labels6,
			series: [sixChannel],
		};

		var options6 = {
			seriesBarDistance: 10,
			axisX: {
				showGrid: false,
			},
			axisY: {
				onlyInteger: true,
				offset: 30,
			},
			height: '200px',
			plugins: [Chartist.plugins.tooltip()],
		};

		var responsiveOptions6 = [
			[
				'screen and (max-width: 640px)',
				{
					seriesBarDistance: 5,
					axisX: {
						labelInterpolationFnc: function(value) {
							return value[0];
						},
					},
				},
			],
		];
		var sixGChart = Chartist.Bar('#channelChart6GHz', data6, options6, responsiveOptions5);
		sixGChart.on('draw', function(data) {
			if (data.type == 'bar') {
				data.element.animate({
					y2: {
						dur: '0.2s',
						from: data.y1,
						to: data.y2,
					},
				});
			}
		});
		channelNotification.close();
	});
}

/*  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
		Optimizations
	------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
// Updated: 1.8.0
function getAirmatchOptimization() {
	optimizationNotification = showNotification('ca-hotspot', 'Getting AirMatch Optimisation...', 'bottom', 'center', 'info');

	//select = document.getElementById('optimizationselector');
	//select.options.length = 0;

	$('#lastrun-table')
		.DataTable()
		.clear();
	$('#lastrun-table')
		.DataTable()
		.rows()
		.draw();

	// Grab the optimizations - latest 11 (1 for Latest section, next 10 for the table)
	var settings = {
		url: getAPIURL() + '/tools/getCommandwHeaders',
		method: 'POST',
		timeout: 0,
		headers: {
			'Content-Type': 'application/json',
		},
		data: JSON.stringify({
			url: localStorage.getItem('base_url') + '/airmatch/solver/v1/optimization?count=11',
			access_token: localStorage.getItem('access_token'),
		}),
	};

	$.ajax(settings).done(function(commandResults, statusText, xhr) {
		if (commandResults.hasOwnProperty('headers')) {
			updateAPILimits(JSON.parse(commandResults.headers));
		}
		if (commandResults.hasOwnProperty('status') && commandResults.status === '503') {
			logError('Central Server Error (503): ' + commandResults.reason + ' (/airmatch/solver/v1/optimization)');
			apiErrorCount++;
			return;
		} else if (commandResults.hasOwnProperty('error_code')) {
			logError(commandResults.description);
			apiErrorCount++;
			return;
		}
		var response = JSON.parse(commandResults.responseBody);

		var optimizationIndex = 0;

		$.each(response, function() {
			//console.log(this);
			// Reset variables
			var airMatchEpoch;
			var two_deployed = false;
			var five_deployed = false;
			var six_deployed = false;
			var two_improvement = 0;
			var five_improvement = 0;
			var six_improvement = 0;
			var two_num_ap = 0;
			var five_num_ap = 0;
			var six_num_ap = 0;
			var two_num_radios = 0;
			var five_num_radios = 0;
			var six_num_radios = 0;
			var sequence = 0;
			var two_new_radios = false;
			var five_new_radios = false;
			var six_new_radios = false;
			var two_counter = 0;
			var five_counter = 0;
			var six_counter = 0;
			var runmode = 0;

			var results = [];
			var optimization = this;
			var timestamp = '';

			// need to loop through Band:RFDomain:RFPartition keys in the list...
			var optimizationKeys = Object.keys(this);
			$.each(optimizationKeys, function() {
				var currentData = optimization[this];
				var container = this.toString().split(':');
				var rfBand = container[0];
				var rfDomain = container[1];
				var rfPartition = container[2];

				// Inject RF Domain and RF Partition into each AP in the result
				var currentResult = [];
				$.each(currentData['result'], function() {
					this['rf_domain'] = rfDomain;
					this['rf_partition'] = rfPartition;
					currentResult.push(this);
				});

				if (rfBand === '2.4GHz') {
					// Add together all the 2.4Ghz data - AP counts, Radio counts, Improvement (will be averaged across all rf domains and partitions)
					timestamp = currentData['timestamp'];
					airMatchEpoch = currentData['timestamp'];
					if (currentData['timestamp'] >= airMatchEpoch) {
						airMatchEpoch = currentData['timestamp'];
						two_deployed = currentData['meta']['deploy'];
					}
					two_improvement = two_improvement + currentData['meta']['improvement_percent'];
					two_counter++;
					two_num_ap = two_num_ap + currentData['num_ap'];
					two_num_radios = two_num_radios + currentData['num_radio'];
					two_new_radios = currentData['meta']['new_radios_computed'];
					runmode = currentData['runmode'];
					results = results.concat(currentResult);
				} else if (rfBand === '5GHz') {
					// Add together all the 5Ghz data - AP counts, Radio counts, Improvement (will be averaged across all rf domains and partitions)
					timestamp = currentData['timestamp'];
					airMatchEpoch = currentData['timestamp'];
					if (currentData['timestamp'] >= airMatchEpoch) {
						airMatchEpoch = currentData['timestamp'];
						five_deployed = currentData['meta']['deploy'];
					}
					five_improvement = five_improvement + currentData['meta']['improvement_percent'];
					five_counter++;
					five_num_ap = five_num_ap + currentData['num_ap'];
					five_num_radios = five_num_radios + currentData['num_radio'];
					five_new_radios = currentData['meta']['new_radios_computed'];
					runmode = currentData['runmode'];
					results = results.concat(currentResult);
				} else if (rfBand === '6GHz') {
					// Add together all the 6Ghz data - AP counts, Radio counts, Improvement (will be averaged across all rf domains and partitions)
					timestamp = currentData['timestamp'];
					airMatchEpoch = currentData['timestamp'];
					if (currentData['timestamp'] >= airMatchEpoch) {
						airMatchEpoch = currentData['timestamp'];
						six_deployed = currentData['meta']['deploy'];
					}
					six_improvement = six_improvement + currentData['meta']['improvement_percent'];
					six_counter++;
					six_num_ap = six_num_ap + currentData['num_ap'];
					six_num_radios = six_num_radios + currentData['num_radio'];
					six_new_radios = currentData['meta']['new_radios_computed'];
					runmode = currentData['runmode'];
					results = results.concat(currentResult);
				}
			});

			// Convert timestamp into actual date
			if (airMatchEpoch < 10000000000) airMatchEpoch *= 1000; // convert to milliseconds (Epoch is usually expressed in seconds, but Javascript uses Milliseconds)
			var airMatchEpoch = airMatchEpoch + new Date().getTimezoneOffset() * -1; //for timeZone
			eventTime = new Date(airMatchEpoch);

			// Convert boolean into words for deployed state
			var two_deployedState = 'Not Deployed';
			if (two_deployed) two_deployedState = 'Deployed';
			var five_deployedState = 'Not Deployed';
			if (five_deployed) five_deployedState = 'Deployed';
			var six_deployedState = 'Not Deployed';
			if (six_deployed) six_deployedState = 'Deployed';

			// Build improvement strings. Averaged out across the RF domains and partitions per band.
			var two_improvement_string =
				two_counter == 0
					? '0'
					: Number(two_improvement / two_counter)
							.toFixed(0)
							.toString();
			var five_improvement_string =
				five_counter == 0
					? '0'
					: Number(five_improvement / five_counter)
							.toFixed(0)
							.toString();
			var six_improvement_string =
				six_counter == 0
					? '0'
					: Number(six_improvement / six_counter)
							.toFixed(0)
							.toString();

			// Pretty up the runmode for display
			var runModeType = 'Scheduled';
			if (runmode == 1) runModeType = 'On-Demand';
			else if (runmode == 2) runModeType = 'Quick';
			else if (runmode == 3) runModeType = 'Incremental';
			else if (runmode == 4) runModeType = 'Incremental - Auto';
			else if (runmode == 5) runModeType = 'EIRP Only';
			else if (runmode == 6) runModeType = 'Opmode';

			if (optimizationIndex == 0) {
				// only update the "Latest" section with the first result
				document.getElementById('airmatch-LastRunDate').innerHTML = 'Date Last Run: <strong>' + eventTime.toLocaleString() + '</strong>';
				document.getElementById('airmatch-RunMode').innerHTML = 'Run Mode: <strong>' + runModeType + '</strong>';

				document.getElementById('airmatch-6-Deployed').innerHTML = '<strong>Deployed:</strong> ' + six_deployedState;
				document.getElementById('airmatch-6-APs').innerHTML = '<strong>APs:</strong> ' + six_num_ap;
				document.getElementById('airmatch-6-Radios').innerHTML = '<strong>Radios:</strong> ' + six_num_radios;
				document.getElementById('airmatch-6-Improvement').innerHTML = '<strong>Improvement:</strong> ' + six_improvement_string + '%';
				document.getElementById('airmatch-6-NewRadios').innerHTML = six_new_radios ? '<strong>New Radios Included:</strong> Yes' : '<strong>New Radios Included:</strong> No';

				document.getElementById('airmatch-5-Deployed').innerHTML = '<strong>Deployed:</strong> ' + five_deployedState;
				document.getElementById('airmatch-5-APs').innerHTML = '<strong>APs:</strong> ' + five_num_ap;
				document.getElementById('airmatch-5-Radios').innerHTML = '<strong>Radios:</strong> ' + five_num_radios;
				document.getElementById('airmatch-5-Improvement').innerHTML = '<strong>Improvement:</strong> ' + five_improvement_string + '%';
				document.getElementById('airmatch-5-NewRadios').innerHTML = five_new_radios ? '<strong>New Radios Included:</strong> Yes' : '<strong>New Radios Included:</strong> No';

				document.getElementById('airmatch-2-Deployed').innerHTML = '<strong>Deployed:</strong> ' + two_deployedState;
				document.getElementById('airmatch-2-APs').innerHTML = '<strong>APs:</strong> ' + two_num_ap;
				document.getElementById('airmatch-2-Radios').innerHTML = '<strong>Radios:</strong> ' + two_num_radios;
				document.getElementById('airmatch-2-Improvement').innerHTML = '<strong>Improvement: </strong> ' + two_improvement_string + '%';
				document.getElementById('airmatch-2-NewRadios').innerHTML = two_new_radios ? '<strong>New Radios Included:</strong> Yes' : '<strong>New Radios Included:</strong> No';

				document.getElementById('loadOptimizationBtn').setAttribute('onClick', 'javascript: loadOptimization(' + timestamp + ',false);');
			} else {
				// rest of the results go into the table
				var table = $('#lastrun-table').DataTable();
				table.row.add([timestamp, '<strong><span style="display:none;">' + airMatchEpoch + '</span>' + eventTime.toLocaleString() + '</strong>', runModeType, six_deployedState, six_num_ap, six_num_radios, six_improvement_string, five_deployedState, five_num_ap, five_num_radios, five_improvement_string, two_deployedState, two_num_ap, two_num_radios, two_improvement_string]);
			}

			// Add the radio info in under the timestamp
			optimizations[timestamp] = results;

			airMatchEpoch = timestamp;
			if (airMatchEpoch < 10000000000) airMatchEpoch *= 1000; // convert to milliseconds (Epoch is usually expressed in seconds, but Javascript uses Milliseconds)
			var airMatchEpoch = airMatchEpoch + new Date().getTimezoneOffset() * -1; //for timeZone
			eventTime = new Date(airMatchEpoch);
			//$('#optimizationselector').append($('<option>', { value: timestamp, text: eventTime.toLocaleString() }));
			//$('#optimizationselector').selectpicker('refresh');
			//$('#optimizationselector').selectpicker('val', getLatestOptimizationDate());

			optimizationIndex++;

			$('#lastrun-table')
				.DataTable()
				.rows()
				.draw();
		});
		optimizationNotification.close();
	});
}

// Updated: 1.8.0
function loadOptimization(timestamp, updateData) {
	$('#optimization-table')
		.DataTable()
		.clear();

	currentTimestamp = timestamp;
	var results = optimizations[timestamp];
	var table = $('#optimization-table').DataTable();
	airMatchEpoch = timestamp;
	if (airMatchEpoch < 10000000000) airMatchEpoch *= 1000; // convert to milliseconds (Epoch is usually expressed in seconds, but Javascript uses Milliseconds)
	var airMatchEpoch = airMatchEpoch + new Date().getTimezoneOffset() * -1; //for timeZone
	eventTime = new Date(airMatchEpoch);
	document.getElementById('optimizationTitle').innerHTML = 'Optimization Details: <strong>' + eventTime.toLocaleString() + '</strong>';

	var selectedBand = document.getElementById('bandselector').value;
	var selectedDomain = document.getElementById('domainselector').value;
	var selectedPartition = document.getElementById('partitionselector').value;

	var availableBands = ['All'];
	var availableDomains = ['All'];
	var availablePartitions = ['All'];

	csvDataBuild = [];

	$.each(results, function() {
		var foundAP = findAPForRadio(this['mac']);

		var channel = this['channel'];
		if (this['chan_frozen']) channel = channel + ' *';

		var bandwidth = this['bandwidth'].replace('CBW', '') + 'MHz';
		if (this['cbw_frozen']) bandwidth = bandwidth + ' *';

		var eirp = this['eirp_dbm'] + 'dBm';
		if (this['chan_frozen']) eirp = eirp + ' *';

		var channelList = '';
		var feasibleChannels = this['solver_feas_list']['chan_list'];
		var channelWidths = this['solver_feas_list']['bw_list'];
		$.each(channelWidths, function() {
			if (this.toString() === 'CBW160') channelList += feasibleChannels[this].join('S, ') + 'S, ';
			if (this.toString() === 'CBW80') channelList += feasibleChannels[this].join('E, ') + 'E, ';
			if (this.toString() === 'CBW40') channelList += feasibleChannels[this].join('+, ') + '+, ';
			if (this.toString() === 'CBW20') channelList += feasibleChannels[this].join(', ') + ', ';
		});
		channelList = channelList.replace(/(, $)/, '');

		if (!availableBands.includes(this['band'])) availableBands.push(this['band']);
		if (!availableDomains.includes(this['rf_domain'])) availableDomains.push(this['rf_domain']);
		if (!availablePartitions.includes(this['rf_partition'])) availablePartitions.push(this['rf_partition']);

		if ((selectedBand === 'All' || selectedBand == this['band']) && (selectedDomain === 'All' || selectedDomain == this['rf_domain']) && (selectedPartition === 'All' || selectedPartition == this['rf_partition'])) {
			table.row.add([foundAP['name'], this['band'], '<span data-toggle="tooltip" data-placement="right" title="Valid Channels: ' + channelList + '">' + channel + '</span>', bandwidth, eirp, this['rf_domain'], this['rf_partition']]);

			// Prepare the CSV data for download
			csvDataBuild.push({ [apKey]: foundAP['name'], [bandKey]: this['band'], [channelKey]: channel, [bandwidthKey]: bandwidth, [eirpKey]: eirp, [domainKey]: this['rf_domain'], [partitionKey]: this['rf_partition'], [feasibleKey]: channelList });
		}
	});

	$('#optimization-table')
		.DataTable()
		.rows()
		.draw();

	$('[data-toggle="tooltip"]').tooltip();

	if (!updateData) {
		// Clear out dropdowns to rebuild with latest data
		if (document.getElementById('bandselector')) {
			// remove old groups from the selector
			select = document.getElementById('bandselector');
			select.options.length = 0;
			$.each(availableBands, function() {
				$('#bandselector').append($('<option>', { value: this, text: this }));
			});
			$('#bandselector').selectpicker('refresh');
			$('#bandselector').selectpicker('val', 'All');
		}
		if (document.getElementById('domainselector')) {
			// remove old groups from the selector
			select = document.getElementById('domainselector');
			select.options.length = 0;
			$.each(availableDomains, function() {
				$('#domainselector').append($('<option>', { value: this, text: this }));
			});
			$('#domainselector').selectpicker('refresh');
			$('#domainselector').selectpicker('val', 'All');
		}
		if (document.getElementById('partitionselector')) {
			// remove old groups from the selector
			select = document.getElementById('partitionselector');
			select.options.length = 0;
			$.each(availablePartitions, function() {
				$('#partitionselector').append($('<option>', { value: this, text: this }));
			});
			$('#partitionselector').selectpicker('refresh');
			$('#partitionselector').selectpicker('val', 'All');
		}

		$('#OptimizationModalLink').trigger('click');
	}
}

function reloadOptimizationTable() {
	if (currentTimestamp) loadOptimization(currentTimestamp, true);
}

function getLatestOptimization() {
	var baseData = Object.entries(optimizations);
	var latestData = {};
	var newestTime = 0;
	for (const [key, value] of baseData) {
		if (key > newestTime) {
			newestTime = key;
			latestData = value;
		}
	}
	return latestData;
}

function getLatestOptimizationDate() {
	var baseData = Object.entries(optimizations);
	var latestData = {};
	var newestTime = 0;
	for (const [key, value] of baseData) {
		if (key > newestTime) {
			newestTime = key;
			latestData = key;
		}
	}
	return latestData;
}

function downloadOptimization() {
	var csv = Papa.unparse(csvDataBuild);

	var csvBlob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

	var csvURL = window.URL.createObjectURL(csvBlob);

	var csvLink = document.createElement('a');
	csvLink.href = csvURL;

	var optDate = new Date(+(currentTimestamp * 1000));
	csvLink.setAttribute('download', 'AMOpt_' + moment(optDate).format('YYMMDD-HHmm') + '.csv');
	csvLink.click();
	window.URL.revokeObjectURL(csvLink);
}

/*  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
		Static Radios
	------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
// Updated: 1.8.0
function getStaticRadios() {
	staticNotification = showNotification('ca-snow', 'Getting Static radios...', 'bottom', 'center', 'info');

	$('#static-table')
		.DataTable()
		.clear();
	$('#static-table')
		.DataTable()
		.rows()
		.draw();
	staticRadios = [];

	var settings = {
		url: getAPIURL() + '/tools/getCommandwHeaders',
		method: 'POST',
		timeout: 0,
		headers: {
			'Content-Type': 'application/json',
		},
		data: JSON.stringify({
			url: localStorage.getItem('base_url') + '/airmatch/telemetry/v1/static_radio_all',
			access_token: localStorage.getItem('access_token'),
		}),
	};

	$.ajax(settings).done(function(commandResults, statusText, xhr) {
		if (commandResults.hasOwnProperty('headers')) {
			updateAPILimits(JSON.parse(commandResults.headers));
		}
		if (commandResults.hasOwnProperty('status') && commandResults.status === '503') {
			logError('Central Server Error (503): ' + commandResults.reason + ' (/airmatch/telemetry/v1/static_radio_all)');
			apiErrorCount++;
			return;
		} else if (commandResults.hasOwnProperty('error_code')) {
			logError(commandResults.description);
			apiErrorCount++;
			return;
		}
		var response = JSON.parse(commandResults.responseBody);

		staticRadios = staticRadios.concat(response);
		$.each(response, function() {
			//console.log(this)
			var reason = '';
			var eventTime = null;
			var baseEventTime = null;
			if (this['chan_reason'] === 'AIRMATCH_FREEZE' && this['eirp_reason'] === 'AIRMATCH_FREEZE') {
				// frozen channel add to list...
				var chan_epoch = this['chan_timestamp'];
				var eirp_epoch = this['eirp_timestamp'];
				var epoch;
				if (chan_epoch > eirp_epoch) epoch = chan_epoch;
				else epoch = eirp_epoch;
				baseEventTime = epoch;
				if (epoch < 10000000000) epoch *= 1000; // convert to milliseconds (Epoch is usually expressed in seconds, but Javascript uses Milliseconds)
				var epoch = epoch + new Date().getTimezoneOffset() * -1; //for timeZone
				eventTime = new Date(epoch);
				reason = 'Frozen EIRP & Channel';
			} else if (this['chan_reason'] === 'AIRMATCH_FREEZE') {
				// frozen channel add to list...
				var chan_epoch = this['chan_timestamp'];
				baseEventTime = chan_epoch;
				if (chan_epoch < 10000000000) chan_epoch *= 1000; // convert to milliseconds (Epoch is usually expressed in seconds, but Javascript uses Milliseconds)
				var chan_epoch = chan_epoch + new Date().getTimezoneOffset() * -1; //for timeZone
				eventTime = new Date(chan_epoch);
				reason = 'Frozen Channel';
			} else if (this['eirp_reason'] === 'AIRMATCH_FREEZE') {
				// frozen channel add to list...
				var eirp_epoch = this['eirp_timestamp'];
				baseEventTime = eirp_epoch;
				if (eirp_epoch < 10000000000) eirp_epoch *= 1000; // convert to milliseconds (Epoch is usually expressed in seconds, but Javascript uses Milliseconds)
				var eirp_epoch = eirp_epoch + new Date().getTimezoneOffset() * -1; //for timeZone
				eventTime = new Date(eirp_epoch);
				reason = 'Frozen EIRP';
			}

			if (reason) {
				var bandwidth = this['bandwidth'].replace('CBW', '') + 'MHz';
				var foundAP = findAPForRadio(this['mac']);

				var thawBtn = '<a class="btn btn-link btn-warning" data-toggle="tooltip" data-placement="right" title="Unfreeze AP" onclick="unfreezeAP(\'' + foundAP['serial'] + "', '" + this['band'] + '\')"><i class="fa-solid  fa-sun"></i></a>';

				// Add row to table
				var table = $('#static-table').DataTable();
				table.row.add(['<span style="display:none;">' + baseEventTime + '</span>' + eventTime.toLocaleString(), this['ap_name'], reason, this['channel'], bandwidth, this['eirp'] + 'dBm', thawBtn]);
				$('#static-table')
					.DataTable()
					.rows()
					.draw();
			}
		});
		$('[data-toggle="tooltip"]').tooltip();
		staticNotification.close();
	});
}

// Added: 1.8.0
function unfreezeAP(serial, band) {
	staticNotification = showNotification('ca-sun', 'Unfreezing radio on ' + band, 'bottom', 'center', 'info');
	//console.log(band)

	// Get current AP settings
	var settings = {
		url: getAPIURL() + '/tools/getCommandwHeaders',
		method: 'POST',
		timeout: 0,
		headers: {
			'Content-Type': 'application/json',
		},
		data: JSON.stringify({
			url: localStorage.getItem('base_url') + '/configuration/v2/ap_settings/' + serial,
			access_token: localStorage.getItem('access_token'),
		}),
	};

	$.ajax(settings).done(function(commandResults, statusText, xhr) {
		if (commandResults.hasOwnProperty('headers')) {
			updateAPILimits(JSON.parse(commandResults.headers));
		}
		if (commandResults.hasOwnProperty('status') && commandResults.status === '503') {
			logError('Central Server Error (503): ' + commandResults.reason + ' (/configuration/v2/ap_settings/<SERIAL>)');
			apiErrorCount++;
			return;
		} else if (commandResults.hasOwnProperty('error_code')) {
			logError(commandResults.description);
			apiErrorCount++;
			return;
		}
		var response = JSON.parse(commandResults.responseBody);

		// Update ap settings
		var settings = {
			url: getAPIURL() + '/tools/postCommand',
			method: 'POST',
			timeout: 0,
			headers: {
				'Content-Type': 'application/json',
			},
			data: JSON.stringify({
				url: localStorage.getItem('base_url') + '/configuration/v2/ap_settings/' + serial,
				access_token: localStorage.getItem('access_token'),
				data: JSON.stringify({ achannel: band === '5GHz' ? '0' : response.achannel, atxpower: band === '5GHz' ? '-127' : response.atxpower, dot11a_radio_disable: response.dot11a_radio_disable, dot11g_radio_disable: response.dot11g_radio_disable, gchannel: band === '2.4GHz' ? '0' : response.gchannel, gtxpower: band === '2.4GHz' ? '-127' : response.gtxpower, ip_address: response.ip_address, usb_port_disable: response.usb_port_disable, zonename: response.zonename, hostname: response.hostname }),
			}),
		};

		$.ajax(settings).done(function(response, statusText, xhr) {
			if (response.hasOwnProperty('status')) {
				if (response.status === '503') {
					apiErrorCount++;
					logError('Central Server Error (503): ' + response.reason + ' (/configuration/v2/ap_settings/<SERIAL>)');
					return;
				}
			}
			if (response !== serial) {
				logError(serial + ' was not unfrozen');
				//console.log(response.reason);
				apiErrorCount++;
			} else {
				showNotification('ca-sun', 'Radio unfrozen on ' + band, 'bottom', 'center', 'success');
				$('#static-table')
					.DataTable()
					.clear();
				$('#static-table')
					.DataTable()
					.rows()
					.draw();
				staticRadios = [];
				getStaticRadios();
			}
		});
		staticNotification.close();
	});
}

// Added: 1.8.0
function selectAPsToFreeze() {
	selectedDevices = {};
	$('#freeze-ap-table')
		.DataTable()
		.clear();
	$('#freeze-ap-table')
		.DataTable()
		.rows()
		.draw();
	// load up APs into freeze-ap-table
	var currentAPs = getAPs();

	$.each(currentAPs, function() {
		var checkBoxString = '<input class="" type="checkbox" id="' + this['serial'] + '" onclick="updateSelectedAPs(\'' + this['serial'] + '\')">';
		//if (checked) checkBoxString = '<input class="" type="checkbox" id="'+this["serial"]+'" onclick="updateSelectedAPs(\''+this["serial"]+'\')" checked>';

		// Build Status dot
		var status = '<i class="fa-solid fa-circle text-danger"></i>';
		if (this['status'] === 'Up') {
			status = '<i class="fa-solid fa-circle text-success"></i>';
		}

		// Build Channels and power
		var channel5 = '-';
		var power5 = '-';
		var channel2 = '-';
		var power2 = '-';
		$.each(this['radios'], function() {
			if (this['band'] == 1 && this['index'] == 0) {
				if (this['channel'] && this['channel'] !== '0') channel5 = this['channel'];
				if (this['tx_power']) power5 = this['tx_power'].toString() + 'dBm';
			} else if (this['band'] == 0) {
				if (this['channel'] && this['channel'] !== '0') channel2 = this['channel'];
				if (this['tx_power']) power2 = this['tx_power'].toString() + 'dBm';
			}
		});

		// Add AP to table
		var table = $('#freeze-ap-table').DataTable();
		table.row.add([checkBoxString, '<strong>' + this['name'] + '</strong>', status, this['serial'], this['macaddr'], this['group_name'], this['site'], channel5 + ' / ' + power5, channel2 + ' / ' + power2]);
	});
	$('#freeze-ap-table')
		.DataTable()
		.rows()
		.draw();
	$('#FreezeModalLink').trigger('click');
}

// Added: 1.8.0
function updateSelectedAPs(serial) {
	if (document.getElementById(serial)) {
		var rowSelected = document.getElementById(serial).checked;
		if (!rowSelected) document.getElementById('ap-select-all').checked = false;

		if (selectedDevices[serial] && !rowSelected) delete selectedDevices[serial];
		else selectedDevices[serial] = serial;
	}
}

// Added: 1.8.0
function freezeSelectedAPs() {
	Swal.fire({
		title: 'Are you sure?',
		text: 'All selected APs will have their EIRP and Channel statically assigned',
		icon: 'warning',
		showCancelButton: true,
		confirmButtonColor: '#23CCEF',
		cancelButtonColor: '#d33',
		confirmButtonText: 'Yes, freeze them!',
	}).then(result => {
		if (result.isConfirmed) {
			confirmedAPFreeze();
		}
	});
}

// Added: 1.8.0
function confirmedAPFreeze() {
	staticNotification = showNotification('ca-snow', 'Freezing radios on selected APs', 'bottom', 'center', 'info');
	frozenDevices = 0;
	frozenErrors = 0;
	currentAPIndex = 0;
	// freeze first AP
	freezeAP(Object.keys(selectedDevices)[currentAPIndex]);
}

// Added: 1.8.0
function freezeAP(serial) {
	var apMonitoring = findDeviceInMonitoring(serial);
	// Get current AP settings
	var settings = {
		url: getAPIURL() + '/tools/getCommandwHeaders',
		method: 'POST',
		timeout: 0,
		headers: {
			'Content-Type': 'application/json',
		},
		data: JSON.stringify({
			url: localStorage.getItem('base_url') + '/configuration/v2/ap_settings/' + serial,
			access_token: localStorage.getItem('access_token'),
		}),
	};

	$.ajax(settings).done(function(commandResults, statusText, xhr) {
		if (commandResults.hasOwnProperty('headers')) {
			updateAPILimits(JSON.parse(commandResults.headers));
		}
		if (commandResults.hasOwnProperty('status') && commandResults.status === '503') {
			logError('Central Server Error (503): ' + commandResults.reason + ' (/configuration/v2/ap_settings/<SERIAL>)');
			apiErrorCount++;
			return;
		} else if (commandResults.hasOwnProperty('error_code')) {
			logError(commandResults.description);
			apiErrorCount++;
			return;
		}
		var response = JSON.parse(commandResults.responseBody);
		// Update ap settings back into Central
		var channel5 = '0';
		var power5 = '-127';
		var channel2 = '0';
		var power2 = '-127';

		$.each(apMonitoring['radios'], function() {
			//console.log(this)
			if (this['band'] == 1 && this['index'] == 0) {
				if (this['channel'] && this['channel'] !== '0') channel5 = this['channel'];
				if (channel5.includes('-')) {
					// convert from - to a + channel
					channel5int = parseInt(channel5.slice(0, -1));
					channel5int = channel5int - 4;
					channel5 = channel5int.toString() + '+';
				}
				if (this['tx_power']) power5 = this['tx_power'].toString();
			} else if (this['band'] == 0) {
				if (this['channel'] && this['channel'] !== '0') channel2 = this['channel'];
				if (this['tx_power']) power2 = this['tx_power'].toString();
			}
		});

		var apZone = response.zonename;
		if (apZone === '_#ALL#_') apZone = '';

		var settings = {
			url: getAPIURL() + '/tools/postCommand',
			method: 'POST',
			timeout: 0,
			headers: {
				'Content-Type': 'application/json',
			},
			data: JSON.stringify({
				url: localStorage.getItem('base_url') + '/configuration/v2/ap_settings/' + serial,
				access_token: localStorage.getItem('access_token'),
				data: JSON.stringify({ achannel: channel5, atxpower: power5, dot11a_radio_disable: response.dot11a_radio_disable, dot11g_radio_disable: response.dot11g_radio_disable, gchannel: channel2, gtxpower: power2, ip_address: response.ip_address, usb_port_disable: response.usb_port_disable, zonename: apZone, hostname: response.hostname }),
			}),
		};

		$.ajax(settings).done(function(response, statusText, xhr) {
			if (xhr.status != 200) {
				logError(serial + ' was not frozen');
				//console.log(response.reason);
				frozenErrors++;
			} else {
				frozenDevices++;
			}

			// check if finished
			if (frozenDevices + frozenErrors == Object.keys(selectedDevices).length) {
				if (frozenErrors > 0) {
					Swal.fire({
						title: 'Freeze Failure',
						text: 'Some or all AP radios failed to be frozen',
						icon: 'error',
					});
				} else {
					Swal.fire({
						title: 'Freeze Success',
						text: 'All AP radios were frozen',
						icon: 'success',
					});
				}
				$('#static-table')
					.DataTable()
					.clear();
				$('#static-table')
					.DataTable()
					.rows()
					.draw();
				staticRadios = [];
				getStaticRadios();
			} else {
				// freeze next AP in list
				currentAPIndex++;
				freezeAP(Object.keys(selectedDevices)[currentAPIndex]);
			}
		});
		staticNotification.close();
	});
}

/*  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
		RF Events
	------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
function getRFEvents() {
	eventNotification = showNotification('ca-opening-times', 'Getting Events...', 'bottom', 'center', 'info');

	$('#rfevents-table')
		.DataTable()
		.clear();
	$('#rfevents-table')
		.DataTable()
		.rows()
		.draw();
	rfEvents = [];

	rfEvents = [];
	var settings = {
		url: getAPIURL() + '/tools/getCommandwHeaders',
		method: 'POST',
		timeout: 0,
		headers: {
			'Content-Type': 'application/json',
		},
		data: JSON.stringify({
			url: localStorage.getItem('base_url') + '/airmatch/telemetry/v1/rf_events_all',
			access_token: localStorage.getItem('access_token'),
		}),
	};

	$.ajax(settings).done(function(commandResults, statusText, xhr) {
		if (commandResults.hasOwnProperty('headers')) {
			updateAPILimits(JSON.parse(commandResults.headers));
		}
		if (commandResults.hasOwnProperty('status') && commandResults.status === '503') {
			logError('Central Server Error (503): ' + commandResults.reason + ' (/airmatch/telemetry/v1/rf_events_all)');
			apiErrorCount++;
			return;
		} else if (commandResults.hasOwnProperty('error_code')) {
			logError(commandResults.description);
			apiErrorCount++;
			return;
		}
		var response = JSON.parse(commandResults.responseBody);
		rfEvents = rfEvents.concat(response);
		rfEvents = rfEvents.slice(0, 500);
		$.each(response, function() {
			if (this['mac']) {
				foundAP = findAPForRadio(this['mac']);
				if (!foundAP) {
					foundAP = {};
					foundAP['name'] = this['mac'];
				}
				var epoch = this['timestamp'];
				if (epoch < 10000000000) epoch *= 1000; // convert to milliseconds (Epoch is usually expressed in seconds, but Javascript uses Milliseconds)
				var epoch = epoch + new Date().getTimezoneOffset() * -1; //for timeZone
				var eventTime = new Date(epoch);

				var new_bandwidth = this['new_bandwidth'].replace('CBW', '') + 'MHz';
				var old_bandwidth = this['bandwidth'].replace('CBW', '') + 'MHz';

				var new_channel = this['new_channel'];
				var old_channel = this['channel'];

				var type = this['type'];
				if (type === 'AIRMATCH_SOLVER') type = 'AirMatch Assigned';
				else type = titleCase(noUnderscore(type));

				if (old_bandwidth !== new_bandwidth || old_channel !== new_channel) {
					// Add row to table
					var table = $('#rfevents-table').DataTable();
					table.row.add(['<span style="display:none;">' + this['timestamp'] + '</span>' + eventTime.toLocaleString(), foundAP['name'], type, new_channel, new_bandwidth, old_channel, old_bandwidth]);
				}
			}
		});
		$('#rfevents-table')
			.DataTable()
			.rows()
			.draw();
		eventNotification.close();
	});
}

function getNoiseEvents() {
	noiseNotification = showNotification('ca-radar', 'Getting Radar & Noise Events...', 'bottom', 'center', 'info');

	$('#noise-table')
		.DataTable()
		.clear();
	$('#noise-table')
		.DataTable()
		.rows()
		.draw();
	noiseEvents = [];

	var settings = {
		url: getAPIURL() + '/tools/getCommandwHeaders',
		method: 'POST',
		timeout: 0,
		headers: {
			'Content-Type': 'application/json',
		},
		data: JSON.stringify({
			url: localStorage.getItem('base_url') + '/airmatch/telemetry/v1/priority_rf_events_all',
			access_token: localStorage.getItem('access_token'),
		}),
	};

	$.ajax(settings).done(function(commandResults, statusText, xhr) {
		if (commandResults.hasOwnProperty('headers')) {
			updateAPILimits(JSON.parse(commandResults.headers));
		}
		if (commandResults.hasOwnProperty('status') && commandResults.status === '503') {
			logError('Central Server Error (503): ' + commandResults.reason + ' (/airmatch/telemetry/v1/rf_events_all)');
			apiErrorCount++;
			return;
		} else if (commandResults.hasOwnProperty('error_code')) {
			logError(commandResults.description);
			apiErrorCount++;
			return;
		}
		var response = JSON.parse(commandResults.responseBody);

		//console.log("RF Events: "+ JSON.stringify(response))
		noiseEvents = noiseEvents.concat(response);

		$.each(response, function() {
			if (this['mac']) {
				foundAP = findAPForRadio(this['mac']);
				if (!foundAP) {
					foundAP = {};
					foundAP['name'] = this['mac'];
				}

				var epoch = this['timestamp'];
				if (epoch < 10000000000) epoch *= 1000; // convert to milliseconds (Epoch is usually expressed in seconds, but Javascript uses Milliseconds)
				var epoch = epoch + new Date().getTimezoneOffset() * -1; //for timeZone
				var eventTime = new Date(epoch);

				var bandwidth = this['bandwidth'].replace('CBW', '') + 'MHz';
				// Add row to table
				var table = $('#noise-table').DataTable();
				table.row.add(['<span style="display:none;">' + this['timestamp'] + '</span>' + eventTime.toLocaleString(), foundAP['name'], titleCase(noUnderscore(this['type'])), this['channel'], bandwidth, this['band']]);
			}
		});
		$('#noise-table')
			.DataTable()
			.rows()
			.draw();
		noiseNotification.close();
	});
}

function showRadarFloorplan() {
	$('#RadarModalLink').trigger('click');
}

/*  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
		History
	------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
function getAirMatchHistory() {
	$('#rfhistory-table')
		.DataTable()
		.clear();
	$('#rfhistory-table')
		.DataTable()
		.rows()
		.draw();
	rfhistory = [];

	var aps = getAPs();
	$.each(aps, function() {
		if (this.firmware_version.startsWith('10.')) {
			for (var i = 0, len = this.radios.length; i < len; i++) {
				var url = localStorage.getItem('base_url') + '/airmatch/telemetry/v1/history/' + this.radios[i]['macaddr'];
				if (this.radios[i].band == 3) url = url + '/6GHz';
				else if (this.radios[i].band == 0) url = url + '/5GHz';
				else url = url + '/2.4GHz';

				var settings = {
					url: getAPIURL() + '/tools/getCommandwHeaders',
					method: 'POST',
					timeout: 0,
					headers: {
						'Content-Type': 'application/json',
					},
					data: JSON.stringify({
						url: url,
						access_token: localStorage.getItem('access_token'),
					}),
				};

				$.ajax(settings).done(function(commandResults, statusText, xhr) {
					if (commandResults.hasOwnProperty('headers')) {
						updateAPILimits(JSON.parse(commandResults.headers));
					}
					if (commandResults.hasOwnProperty('status') && commandResults.status === '503') {
						logError('Central Server Error (503): ' + commandResults.reason + ' (/airmatch/telemetry/v1/history/<RADIO-MAC>)');
						apiErrorCount++;
						return;
					} else if (commandResults.hasOwnProperty('error_code')) {
						logError(commandResults.description);
						apiErrorCount++;
						return;
					}
					var response = JSON.parse(commandResults.responseBody);

					//console.log("AirMatch History: "+ JSON.stringify(response))

					rfhistory = rfhistory.concat(response);
					if (response.status && response.status !== 500) {
						$.each(response, function() {
							foundAP = findAPForRadio(this['mac']);
							var epoch = this['timestamp'];
							if (epoch < 10000000000) epoch *= 1000; // convert to milliseconds (Epoch is usually expressed in seconds, but Javascript uses Milliseconds)
							var epoch = epoch + new Date().getTimezoneOffset() * -1; //for timeZone
							var eventTime = new Date(epoch);

							var newBandwidth = this.new['bw'].replace('CBW', '') + 'MHz';
							var oldBandwidth = this.old['bw'].replace('CBW', '') + 'MHz';
							// Add row to table
							var table = $('#rfhistory-table').DataTable();
							table.row.add(['<span style="display:none;">' + this['timestamp'] + '</span>' + eventTime.toLocaleString(), foundAP['name'], this.new['chan'], this.new['eirp'] + 'dBm', newBandwidth, this.old['chan'], this.old['eirp'] + 'dBm', oldBandwidth, titleCase(noUnderscore(this['reason']))]);
						});
					}
					$('#rfhistory-table')
						.DataTable()
						.rows()
						.draw();
				});
			}
		}
	});
}

/*  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
	RF Neighbour functions
------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

function getAPsForNeighbours() {
	$('#neighbour-table')
		.DataTable()
		.rows()
		.remove();

	var table = $('#neighbour-table').DataTable();

	var allAPs = getAPs();
	$.each(allAPs, function() {
		var ap = this;
		if (ap['firmware_version'].startsWith('10.')) {
			var memoryUsage = (((ap['mem_total'] - ap['mem_free']) / ap['mem_total']) * 100).toFixed(0).toString();

			var status = '<i class="fa-solid fa-circle text-danger"></i>';
			if (ap['status'] == 'Up') {
				status = '<span data-toggle="tooltip" data-placement="right" data-html="true" title="CPU Usage: ' + ap['cpu_utilization'] + '%<br>Memory Usage:' + memoryUsage + '%"><i class="fa-solid fa-circle text-success"></i></span>';

				var ip_address = ap['ip_address'];
				if (!ip_address) ip_address = '';

				// Make AP Name as a link to Central
				var name = encodeURI(ap['name']);
				var apiURL = localStorage.getItem('base_url');
				var centralURL = centralURLs[0][apiURL] + '/frontend/#/APDETAILV2/' + ap['serial'] + '?casn=' + ap['serial'] + '&cdcn=' + name + '&nc=access_point';

				var radio2Mac;
				var radio5Mac;
				var radio6Mac;
				$.each(ap['radios'], function() {
					if (this['radio_name'].includes('2.4 GHz') && this['status'] == 'Up') radio2Mac = this['macaddr'];
					else if (this['radio_name'].includes('5 GHz') && this['status'] == 'Up') radio5Mac = this['macaddr'];
					else if (this['radio_name'].includes('6 GHz') && this['status'] == 'Up') radio6Mac = this['macaddr'];
				});

				var tshootBtns = '';
				if (radio2Mac) tshootBtns += '<button class="btn-warning btn-action" onclick="getAPRFNeighbours(\'' + radio2Mac + "','2.4GHz')\">2.4GHz</button> ";
				if (radio5Mac) tshootBtns += '<button class="btn-warning btn-action" onclick="getAPRFNeighbours(\'' + radio5Mac + "','5GHz')\">5GHz</button> ";
				if (radio6Mac) tshootBtns += '<button class="btn-warning btn-action" onclick="getAPRFNeighbours(\'' + radio6Mac + "','6GHz')\">6GHz</button> ";

				// Add row to table
				table.row.add(['<a href="' + centralURL + '" target="_blank"><strong>' + ap['name'] + '</strong></a>', status, ap['status'], ap['serial'], ap['macaddr'], ap['group_name'], ap['site'], tshootBtns]);
			}
		}
	});

	$('[data-toggle="tooltip"]').tooltip();

	// Force reload of table data
	$('#neighbour-table')
		.DataTable()
		.rows()
		.draw();
}

function getAPRFNeighbours(radioMac, band) {
	neighbourNotification = showNotification('ca-duplicate', 'Getting RF Neighbours...', 'bottom', 'center', 'info');
	var apRFNeighbours = [];
	var settings = {
		url: getAPIURL() + '/tools/getCommandwHeaders',
		method: 'POST',
		timeout: 0,
		headers: {
			'Content-Type': 'application/json',
		},
		data: JSON.stringify({
			url: localStorage.getItem('base_url') + '/airmatch/telemetry/v1/nbr_pathloss_radio/' + radioMac + '/' + band,
			access_token: localStorage.getItem('access_token'),
		}),
	};

	$.ajax(settings).done(function(commandResults, statusText, xhr) {
		if (commandResults.hasOwnProperty('headers')) {
			updateAPILimits(JSON.parse(commandResults.headers));
		}
		if (commandResults.hasOwnProperty('status') && commandResults.status === '503') {
			logError('Central Server Error (503): ' + commandResults.reason + ' (/airmatch/telemetry/v1/nbr_pathloss_all/2.4ghz)');
			apiErrorCount++;
			return;
		} else if (commandResults.hasOwnProperty('error_code')) {
			logError(commandResults.description);
			apiErrorCount++;
			return;
		}
		var response = JSON.parse(commandResults.responseBody);

		var thisAP = findAPForRadio(radioMac);
		document.getElementById('apNeighbourTitle').innerHTML = '<strong>' + thisAP['name'] + '</strong> on ' + band;

		$('#neighbour-ap-table')
			.DataTable()
			.rows()
			.remove();

		var table = $('#neighbour-ap-table').DataTable();

		$.each(response, function() {
			var ap = findAPForRadio(this['nbr_mac']);

			var channel = this['channel'];
			if (this['bandwidth'] === 'CBW160') channel += 'S';
			if (this['bandwidth'] === 'CBW80') channel += 'E';
			if (this['bandwidth'] === 'CBW40') channel += '+';

			//var duration = moment.duration(this['timestamp']);
			if (ap) {
				// Make AP Name as a link to Central
				var name = encodeURI(ap['name']);
				var apiURL = localStorage.getItem('base_url');
				var centralURL = centralURLs[0][apiURL] + '/frontend/#/APDETAILV2/' + ap['serial'] + '?casn=' + ap['serial'] + '&cdcn=' + name + '&nc=access_point';

				table.row.add(['<a href="' + centralURL + '" target="_blank"><strong>' + ap['name'] + '</strong></a>', channel, this['pathloss'], this['is_friend'] ? 'Own' : 'Neighbour']);
			} else {
				table.row.add([this['nbr_mac'], channel, this['pathloss'], this['is_friend'] ? 'Own' : 'Neighbour']);
			}
		});

		$('[data-toggle="tooltip"]').tooltip();

		// Force reload of table data
		$('#neighbour-ap-table')
			.DataTable()
			.rows()
			.draw();

		neighbourNotification.close();
		$('#NeighbourModalLink').trigger('click');
	});
}

/*  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
	VisualRF functions
------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
function getCampus(repeat) {
	if (!repeat) visualRFNotification = showNotification('ca-new-construction', 'Getting Buildings...', 'bottom', 'center', 'info');
	var apRFNeighbours = [];
	var settings = {
		url: getAPIURL() + '/tools/getCommandwHeaders',
		method: 'POST',
		timeout: 0,
		headers: {
			'Content-Type': 'application/json',
		},
		data: JSON.stringify({
			url: localStorage.getItem('base_url') + '/visualrf_api/v1/campus?offset=0&limit=100',
			access_token: localStorage.getItem('access_token'),
		}),
	};

	$.ajax(settings).done(function(commandResults, statusText, xhr) {
		if (commandResults.hasOwnProperty('headers')) {
			updateAPILimits(JSON.parse(commandResults.headers));
		}
		if (commandResults.hasOwnProperty('status') && commandResults.status === '503') {
			logError('Central Server Error (503): ' + commandResults.reason + ' (/visualrf_api/v1/campus)');
			apiErrorCount++;
			return;
		} else if (commandResults.hasOwnProperty('error_code')) {
			logError(commandResults.description);
			apiErrorCount++;
			return;
		}
		var response = JSON.parse(commandResults.responseBody);

		vrfBuildings = [];
		// Loop through the campus objects to get all the floors
		if (response['campus']) {
			$.each(response['campus'], function() {
				// Grab the building list for the individual campus
				getBuildings(0, this['campus_id']);
			});
		} else {
			getCampus(true);
		}
	});
}

function getBuildings(offset, campusId) {
	var settings = {
		url: getAPIURL() + '/tools/getCommandwHeaders',
		method: 'POST',
		timeout: 0,
		headers: {
			'Content-Type': 'application/json',
		},
		data: JSON.stringify({
			url: localStorage.getItem('base_url') + '/visualrf_api/v1/campus/' + campusId + '?offset=' + offset + '&limit=' + vrfLimit,
			access_token: localStorage.getItem('access_token'),
		}),
	};

	$.ajax(settings).done(function(commandResults, statusText, xhr) {
		if (commandResults.hasOwnProperty('headers')) {
			updateAPILimits(JSON.parse(commandResults.headers));
		}
		if (commandResults.hasOwnProperty('status') && commandResults.status === '503') {
			logError('Central Server Error (503): ' + commandResults.reason + ' (/visualrf_api/v1/campus/<campus_id>)');
			apiErrorCount++;
			return;
		} else if (commandResults.hasOwnProperty('error_code')) {
			logError(commandResults.description);
			apiErrorCount++;
			return;
		}
		var response = JSON.parse(commandResults.responseBody);
		vrfBuildings = vrfBuildings.concat(response['buildings']);
		offset += vrfLimit;
		if (offset < response['building_count']) getBuildings(offset);
		else {
			// maybe save to indexedDB...
			loadBuildingSelector();

			if (visualRFNotification) {
				visualRFNotification.update({ message: 'Retrieved Building Information', type: 'success' });
				setTimeout(visualRFNotification.close, 1000);
			}
		}
	});
}

function getFloors(offset, triggerLocation) {
	drawingLocation = triggerLocation;
	if (drawingLocation == VisualLocation.Optimization) vrfBuildingId = document.getElementById('opt-buildingselector').value;
	else vrfBuildingId = document.getElementById('radar-buildingselector').value;

	if (offset == 0) {
		resetCanvases();
		vrfFloors = [];
	}
	var settings = {
		url: getAPIURL() + '/tools/getCommandwHeaders',
		method: 'POST',
		timeout: 0,
		headers: {
			'Content-Type': 'application/json',
		},
		data: JSON.stringify({
			url: localStorage.getItem('base_url') + '/visualrf_api/v1/building/' + vrfBuildingId + '?offset=' + offset + '&limit=' + vrfLimit + '&units=' + units,
			access_token: localStorage.getItem('access_token'),
		}),
	};

	$.ajax(settings).done(function(commandResults, statusText, xhr) {
		if (commandResults.hasOwnProperty('headers')) {
			updateAPILimits(JSON.parse(commandResults.headers));
		}
		if (commandResults.hasOwnProperty('status') && commandResults.status === '503') {
			logError('Central Server Error (503): ' + commandResults.reason + ' (/visualrf_api/v1/building/<building_id>)');
			apiErrorCount++;
			return;
		} else if (commandResults.hasOwnProperty('error_code')) {
			logError(commandResults.description);
			apiErrorCount++;
			return;
		}

		var response = JSON.parse(commandResults.responseBody);

		if (response.hasOwnProperty('error')) {
			if (response.error === 'invalid_token') {
				// Access Token expired - get a new one and try again.
				var authPromise = new $.Deferred();
				$.when(authRefresh(authPromise)).then(function() {
					if (!failedAuth) {
						failedAuth = true;
						getFloors(offset);
					}
				});
			}
		} else if (response) {
			failedAuth = false;

			if (response.floor_count == 0) {
				showNotification('ca-floors', 'The ' + response['building']['building_name'] + ' building has no floors', 'bottom', 'center', 'danger');
				resetCanvases();
			} else {
				vrfFloors = vrfFloors.concat(response['floors']);
				offset += vrfLimit;
				if (offset < response['floor_count']) getFloors(offset);
				else {
					// maybe save to indexedDB...
					loadFloorSelector();
				}
			}
		}
	});
}

function getFloorData(triggerLocation) {
	drawingLocation = triggerLocation;
	if (drawingLocation == VisualLocation.Optimization) vrfFloorId = document.getElementById('opt-floorselector').value;
	else vrfFloorId = document.getElementById('radar-floorselector').value;

	//get Floorplan
	if (visualRFNotification) visualRFNotification.update({ message: 'Attempting to obtain floorplan...', type: 'warning' });
	else visualRFNotification = showNotification('ca-floors', 'Getting Floor information...', 'bottom', 'center', 'info');
	var settings = {
		url: getAPIURL() + '/tools/getCommandwHeaders',
		method: 'POST',
		timeout: 0,
		headers: {
			'Content-Type': 'application/json',
		},
		data: JSON.stringify({
			url: localStorage.getItem('base_url') + '/visualrf_api/v1/floor/' + vrfFloorId + '/image?limit=100',
			access_token: localStorage.getItem('access_token'),
		}),
	};

	$.ajax(settings).done(function(commandResults, statusText, xhr) {
		if (commandResults.hasOwnProperty('headers')) {
			updateAPILimits(JSON.parse(commandResults.headers));
		}
		if (commandResults.hasOwnProperty('status') && commandResults.status === '503') {
			logError('Central Server Error (503): ' + commandResults.reason + ' (/visualrf_api/v1/floor/<floor_id>/image)');
			apiErrorCount++;
			return;
		} else if (commandResults.hasOwnProperty('error_code')) {
			logError(commandResults.description);
			apiErrorCount++;
			return;
		}
		var response = JSON.parse(commandResults.responseBody);
		vrfFloorplan = response;
		if (!vrfFloorplan || vrfFloorplan === '') {
			visualRFNotification.update({ message: 'Attempting to obtain floorplan...', type: 'warning' });
		} else {
			drawFloorplan();

			if (visualRFNotification) {
				visualRFNotification.update({ message: 'Retrieved Floorplan', type: 'success' });
				setTimeout(visualRFNotification.close, 1000);
			}
		}
	});
}

function drawFloorplan() {
	// Draw floorplan for specific part of AirMatch Page
	if (drawingLocation == VisualLocation.Optimization) {
		var superView = document.getElementById('opt-visualPlan');

		var canvas = document.getElementById('opt-floorplanCanvas');
		var ctx = canvas.getContext('2d');
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		var linkCanvas = document.getElementById('opt-linkCanvas');
		var pathlossCtx = linkCanvas.getContext('2d');
		pathlossCtx.clearRect(0, 0, linkCanvas.width, linkCanvas.height);

		var apCanvas = document.getElementById('opt-apCanvas');
		var apCtx = apCanvas.getContext('2d');
		apCtx.clearRect(0, 0, apCanvas.width, apCanvas.height);

		var background = new Image();
		background.src = 'data:image/png;base64,' + vrfFloorplan;
		background.onload = function() {
			var normalWidth = superView.offsetWidth - 40;
			var normalHeight = normalWidth * (background.height / background.width);
			updateSizes(VisualLocation.Optimization, normalWidth, normalHeight);
			ctx.drawImage(background, 0, 0, normalWidth, normalHeight);
			ctx.textBaseline = 'middle';
			ctx.textAlign = 'center';
		};

		needChannelList = true;
	} else if (drawingLocation == VisualLocation.Radar) {
		var superView = document.getElementById('radar-visualPlan');

		var canvas = document.getElementById('radar-floorplanCanvas');
		var ctx = canvas.getContext('2d');
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		var apCanvas = document.getElementById('radar-apCanvas');
		var apCtx = apCanvas.getContext('2d');
		apCtx.clearRect(0, 0, apCanvas.width, apCanvas.height);

		var background = new Image();
		background.src = 'data:image/png;base64,' + vrfFloorplan;
		background.onload = function() {
			var normalWidth = superView.offsetWidth - 40;
			var normalHeight = normalWidth * (background.height / background.width);
			updateSizes(VisualLocation.Radar, normalWidth, normalHeight);
			ctx.drawImage(background, 0, 0, normalWidth, normalHeight);
			ctx.textBaseline = 'middle';
			ctx.textAlign = 'center';
		};
	}

	loadAPsForFloor(0);
}

function loadAPsForFloor(offset) {
	if (offset == 0) {
		vrfAPs = [];
		vrfChannels = { 2: [], 5: [], 6: [] };
		clearAPCanvas();
		clearLinkCanvas();
	}

	var settings = {
		url: getAPIURL() + '/tools/getCommandwHeaders',
		method: 'POST',
		timeout: 0,
		headers: {
			'Content-Type': 'application/json',
		},
		data: JSON.stringify({
			url: localStorage.getItem('base_url') + '/visualrf_api/v1/floor/' + vrfFloorId + '/access_point_location?offset=' + offset + '&limit=' + vrfLimit + '&units=' + units,
			access_token: localStorage.getItem('access_token'),
		}),
	};

	$.ajax(settings).done(function(commandResults, statusText, xhr) {
		if (commandResults.hasOwnProperty('headers')) {
			updateAPILimits(JSON.parse(commandResults.headers));
		}
		if (commandResults.hasOwnProperty('status') && commandResults.status === '503') {
			logError('Central Server Error (503): ' + commandResults.reason + ' (/visualrf_api/v1/floor/<floor_id>/access_point_location)');
			apiErrorCount++;
			return;
		} else if (commandResults.hasOwnProperty('error_code')) {
			logError(commandResults.description);
			apiErrorCount++;
			return;
		}
		var response = JSON.parse(commandResults.responseBody);
		currentFloor = response['floor'];
		vrfAPs = vrfAPs.concat(response['access_points']);
		//console.log(vrfAPs);
		offset += vrfLimit;
		if (offset < response['access_point_count']) {
			loadAPsForFloor(offset);
		} else {
			if (drawingLocation == VisualLocation.Optimization) drawAPsOnFloorplan();
			else if (drawingLocation == VisualLocation.Radar) drawRadarOnFloorplan();
		}
	});
}

function drawAPsOnFloorplan() {
	// Clear APs from view
	clearAPCanvas();
	clearLinkCanvas();

	// Draw APs on floorplan
	vrfSelectedAPs = {};
	var floorplanCanvas = document.getElementById('opt-floorplanCanvas');
	var canvas = document.getElementById('opt-apCanvas');
	var ctx = canvas.getContext('2d');
	$.each(vrfAPs, function() {
		ap_name = this['ap_name'];
		var currentAP = findDeviceInMonitoring(this['serial_number']);
		if (needChannelList) {
			$.each(currentAP.radios, function() {
				var currentChannel = this.channel.replace(/\D/g, '');
				if (currentChannel !== '') {
					if (this.radio_name.includes('2.4 GHz') && !vrfChannels[2].includes(currentChannel)) {
						var currentChannels = vrfChannels[2];
						currentChannels.push(currentChannel);
						currentChannels.sort(function(a, b) {
							return a - b;
						});
						vrfChannels[2] = currentChannels;
					} else if (this.radio_name.includes('5 GHz') && !vrfChannels[5].includes(currentChannel)) {
						var currentChannels = vrfChannels[5];
						currentChannels.push(currentChannel);
						currentChannels.sort(function(a, b) {
							return a - b;
						});
						vrfChannels[5] = currentChannels;
					} else if (this.radio_name.includes('6 GHz') && !vrfChannels[6].includes(currentChannel)) {
						var currentChannels = vrfChannels[6];
						currentChannels.push(currentChannel);
						currentChannels.sort(function(a, b) {
							return a - b;
						});
						vrfChannels[6] = currentChannels;
					}
				}
			});
			updateChannelSelector();
		}

		x = (this['x'] / currentFloor['floor_width']) * (canvas.width / ratio);
		y = (this['y'] / currentFloor['floor_length']) * (canvas.height / ratio);

		// Get Partition for AP to set colour
		vrfOptimization = optimizations[currentTimestamp];
		ctx.fillStyle = 'white';

		$('#visualLegend').empty();
		if (document.getElementById('visualizationselector').value === 'eirp') {
			$('#visualLegend').append('<i class="fa-solid fa-circle text-info"></i> 0-6dBm  ');
			$('#visualLegend').append('<i class="fa-solid fa-circle text-danger"></i> 7-9dBm  ');
			$('#visualLegend').append('<i class="fa-solid fa-circle text-warning"></i> 10-12dBm  ');
			$('#visualLegend').append('<i class="fa-solid fa-circle text-purple"></i> 13-15dBm  ');
			$('#visualLegend').append('<i class="fa-solid fa-circle text-success"></i> 16-18dBm  ');
			$('#visualLegend').append('<i class="fa-solid fa-circle text-primary"></i> 19-21dBm  ');
			$('#visualLegend').append('<i class="fa-solid fa-circle text-series7"></i> 22-24dBm  ');
			$('#visualLegend').append('<i class="fa-solid fa-circle text-series8"></i> 25+dBm ');
		} else if (document.getElementById('visualizationselector').value === 'unii') {
			var band = document.getElementById('neighbourbandselector').value;
			if (band == 5) {
				$('#visualLegend').append('<i class="fa-solid fa-circle text-info"></i> UNII-1  ');
				$('#visualLegend').append('<i class="fa-solid fa-circle text-danger"></i> UNII-2A ');
				$('#visualLegend').append('<i class="fa-solid fa-circle text-warning"></i> UNII-2C  ');
				$('#visualLegend').append('<i class="fa-solid fa-circle text-purple"></i> UNII-3  ');
				$('#visualLegend').append('<i class="fa-solid fa-circle text-success"></i> UNII-4  ');
			} else if (band == 6) {
				$('#visualLegend').append('<i class="fa-solid fa-circle text-info"></i> UNII-5  ');
				$('#visualLegend').append('<i class="fa-solid fa-circle text-danger"></i> UNII-6 ');
				$('#visualLegend').append('<i class="fa-solid fa-circle text-warning"></i> UNII-7  ');
				$('#visualLegend').append('<i class="fa-solid fa-circle text-purple"></i> UNII-8  ');
			}
		} else if (document.getElementById('visualizationselector').value === 'pathloss') {
			$('#visualLegend').append('<i class="fa-solid fa-circle text-success"></i> <70dB  ');
			$('#visualLegend').append('<i class="fa-solid fa-circle text-warning"></i> <90dB  ');
			$('#visualLegend').append('<i class="fa-solid fa-circle text-danger"></i> <110dB  ');
		}

		$.each(vrfOptimization, function() {
			var foundAP = findAPForRadio(this['mac']);
			if (foundAP.name === currentAP.name) {
				var band = document.getElementById('neighbourbandselector').value;
				if (document.getElementById('visualizationselector').value === 'pathloss') {
					if (this.channel.toString() === document.getElementById('neighbourchannelselector').value || document.getElementById('neighbourchannelselector').value === 'All') {
						ctx.fillStyle = apColors[this['rf_partition']];
						var foundSerial = foundAP['serial'];
						vrfSelectedAPs[foundSerial] = this['mac'];
						if (band == 2) band = 2.4;
						if (band + 'GHz' == this.band) {
							var channel = this['channel'];
							if (this['bandwidth'] === 'CBW160') channel += 'S';
							if (this['bandwidth'] === 'CBW80') channel += 'E';
							if (this['bandwidth'] === 'CBW40') channel += '+';
							ap_name += '\n' + channel;
						}
					}
				} else if (document.getElementById('visualizationselector').value === 'channels') {
					if (this.channel.toString() === document.getElementById('neighbourchannelselector').value || document.getElementById('neighbourchannelselector').value === 'All') {
						//ctx.fillStyle = apColors[this['rf_partition']];
						var channel = this['channel'];
						if (band == 2) band = 2.4;
						if (band + 'GHz' == this.band && band == 2.4) {
							if (parseInt(channel) == 1) {
								ctx.fillStyle = apColors[0];
							} else if (parseInt(channel) == 6) {
								ctx.fillStyle = apColors[1];
							} else if (parseInt(channel) == 11) {
								ctx.fillStyle = apColors[2];
							}
						}

						if (band + 'GHz' == this.band && band == 5) {
							ctx.fillStyle = apColors[labels5.indexOf(channel.toString())];
						}

						if (band + 'GHz' == this.band && band == 6) {
							if (parseInt(channel) < 97) {
								ctx.fillStyle = apColors[0];
							} else if (parseInt(channel) < 189) {
								ctx.fillStyle = apColors[1];
							} else if (parseInt(channel) < 234) {
								ctx.fillStyle = apColors[2];
							}
						}

						if (band == 2) band = 2.4;
						if (band + 'GHz' == this.band) {
							if (this['bandwidth'] === 'CBW160') channel += 'S';
							if (this['bandwidth'] === 'CBW80') channel += 'E';
							if (this['bandwidth'] === 'CBW40') channel += '+';
							ap_name += '\n' + channel;
						}
					}
				} else if (document.getElementById('visualizationselector').value === 'eirp') {
					if (this.channel.toString() === document.getElementById('neighbourchannelselector').value || document.getElementById('neighbourchannelselector').value === 'All') {
						//ctx.fillStyle = apColors[this['rf_partition']];
						var power = this['eirp_dbm'];

						if (band == 2) band = 2.4;
						if (band + 'GHz' == this.band) {
							ap_name += '\n' + power + 'dBm';
							if (power <= 6) {
								ctx.fillStyle = apColors[0];
							} else if (power <= 9) {
								ctx.fillStyle = apColors[1];
							} else if (power <= 12) {
								ctx.fillStyle = apColors[2];
							} else if (power <= 15) {
								ctx.fillStyle = apColors[3];
							} else if (power <= 18) {
								ctx.fillStyle = apColors[4];
							} else if (power <= 21) {
								ctx.fillStyle = apColors[5];
							} else if (power <= 24) {
								ctx.fillStyle = apColors[6];
							} else if (power >= 25) {
								ctx.fillStyle = apColors[7];
							}
						}
					}
				} else if (document.getElementById('visualizationselector').value === 'unii') {
					if (this.channel.toString() === document.getElementById('neighbourchannelselector').value || document.getElementById('neighbourchannelselector').value === 'All') {
						var channel = this['channel'];
						if (this.band == band + '.4GHz' && band == 2) {
							ctx.fillStyle = apColors[0];
							ap_name += '\n' + channel;
						} else if (this.band == band + 'GHz' && band == 5) {
							if (this['bandwidth'] === 'CBW160') channel += 'S';
							if (this['bandwidth'] === 'CBW80') channel += 'E';
							if (this['bandwidth'] === 'CBW40') channel += '+';
							if (parseInt(channel) < 50) {
								ctx.fillStyle = apColors[0];
								ap_name += '\n' + channel;
							} else if (parseInt(channel) < 65) {
								ctx.fillStyle = apColors[1];
								ap_name += '\n' + channel;
							} else if (parseInt(channel) < 145) {
								ctx.fillStyle = apColors[2];
								ap_name += '\n' + channel;
							} else if (parseInt(channel) < 166) {
								ctx.fillStyle = apColors[3];
								ap_name += '\n' + channel;
							} else if (parseInt(channel) < 178) {
								ctx.fillStyle = apColors[4];
								ap_name += '\n' + channel;
							}
						} else if (this.band == band + 'GHz' && band == 6) {
							if (this['bandwidth'] === 'CBW160') channel += 'S';
							if (this['bandwidth'] === 'CBW80') channel += 'E';
							if (this['bandwidth'] === 'CBW40') channel += '+';
							if (parseInt(channel) < 97) {
								ctx.fillStyle = apColors[0];
								ap_name += '\n' + channel;
							} else if (parseInt(channel) < 189) {
								ctx.fillStyle = apColors[1];
								ap_name += '\n' + channel;
							} else if (parseInt(channel) < 234) {
								ctx.fillStyle = apColors[2];
								ap_name += '\n' + channel;
							}
						}
					}
				}
			}
		});

		ctx.beginPath();
		ctx.shadowColor = 'white';
		ctx.shadowBlur = 14;
		ctx.roundRect(x - 7, y - 7, 14, 14, 2);
		ctx.fill();
		ctx.drawImage(apImage, x - 8, y - 8, 16, 16);

		// Put white background to the text so it's readable
		ctx.shadowColor = ctx.fillStyle;
		ctx.shadowBlur = 2;
		ap_name_size = ctx.measureText(ap_name);
		ctx.fillStyle = '#e8e8e8';
		ctx.fillRect(x - ap_name_size.width / 2 - 4, y + 10, ap_name_size.width + 6, 14);

		ctx.shadowBlur = 0;
		ctx.fillStyle = 'black';
		ctx.fillText(ap_name, x - ap_name_size.width / 2, y + 20);
	});

	needChannelList = false;

	canvas.onmousemove = function(e) {
		// important: correct mouse position:
		var rect = this.getBoundingClientRect();
		var x = e.clientX - rect.left;
		var y = e.clientY - rect.top;
		var i = 0;
		var r;

		found = false;
		$.each(vrfAPs, function() {
			ap_x = (this['x'] / currentFloor['floor_width']) * (canvas.width / ratio);
			ap_y = (this['y'] / currentFloor['floor_length']) * (canvas.height / ratio);
			if (Math.abs(ap_x - x) <= 16 && Math.abs(ap_y - y) <= 16) {
				if (currentAP !== this) {
					found = true;
					currentAP = this;
					var currentSerial = currentAP['serial_number'];
					clearLinkCanvas();
					if (vrfSelectedAPs[currentSerial]) drawApLinks(currentAP['serial_number']);
				}
			}
		});
	};
}

function drawRadarOnFloorplan() {
	// Clear APs from view
	clearAPCanvas();

	// Get Timescale
	var select = document.getElementById('timescalePicker');
	var timescale = select.value;
	var now = new Date();

	// Draw APs on floorplan
	vrfSelectedAPs = {};
	var canvas = document.getElementById('radar-apCanvas');
	var floorplanCanvas = document.getElementById('radar-floorplanCanvas');
	var ctx = canvas.getContext('2d');
	$.each(vrfAPs, function() {
		var apLabel1 = this['ap_name'];
		var apLabel2 = null;
		var currentAP = findDeviceInMonitoring(this['serial_number']);

		x = (this['x'] / currentFloor['floor_width']) * (canvas.width / ratio);
		y = (this['y'] / currentFloor['floor_length']) * (canvas.height / ratio);
		// AP with no Radar hits will be white.
		ctx.fillStyle = 'white';
		var hitCounter = 0;

		$.each(noiseEvents, function() {
			if (this['type'] === 'RADAR_DETECTED') {
				// convert timescale and timestamp ms
				var fromTime = Math.floor(now.getTime() - timescale * 60 * 1000);
				var eventTime = this['timestamp'] * 1000;

				if (eventTime > fromTime) {
					var foundAP = findAPForRadio(this['mac']);
					if (foundAP.name === currentAP.name) {
						hitCounter++;
						apLabel2 = this['channel'];
						ctx.fillStyle = apColors[1];
					}
				}
			}
		});

		// Coloured to match the number of radar hits on an AP.
		if (hitCounter > 0) ctx.fillStyle = apColors[hitCounter - 1];
		if (hitCounter > 6) ctx.fillStyle = apColors[5];

		ctx.beginPath();
		ctx.roundRect(x - 7, y - 7, 14, 14, 2);
		ctx.fill();
		ctx.drawImage(apImage, x - 8, y - 8, 16, 16);

		if (apLabel2) {
			apLabel1_size = ctx.measureText(apLabel1);
			apLabel2_size = ctx.measureText(apLabel2);
			var boxSize = apLabel1_size;
			if (apLabel2_size.width > apLabel1_size.width) boxSize = apLabel2_size;
			ctx.strokeStyle = 'black';
			ctx.shadowColor = 'black';
			ctx.shadowBlur = 2;
			ctx.fillStyle = 'white';
			ctx.fillRect(x - boxSize.width / 2 - 4, y + 12, boxSize.width + 6, 24);
			ctx.shadowBlur = 0;
			ctx.fillStyle = 'black';
			ctx.fillText(apLabel1, x - apLabel1_size.width / 2, y + 22);
			ctx.fillText(apLabel2, x - apLabel2_size.width / 2, y + 32);
		} else if (apLabel1) {
			apLabel1_size = ctx.measureText(apLabel1);
			ctx.strokeStyle = 'black';
			ctx.shadowColor = 'black';
			ctx.shadowBlur = 2;
			ctx.fillStyle = 'white';
			ctx.fillRect(x - apLabel1_size.width / 2 - 4, y + 12, apLabel1_size.width + 6, 14);
			ctx.shadowBlur = 0;
			ctx.fillStyle = 'black';
			ctx.fillText(apLabel1, x - apLabel1_size.width / 2, y + 22);
		}
	});

	needChannelList = false;
}

function clearLinkCanvas() {
	var linkCanvas = document.getElementById('opt-linkCanvas');
	var pathlossCtx = linkCanvas.getContext('2d');
	pathlossCtx.clearRect(0, 0, linkCanvas.width, linkCanvas.height);
}

function clearAPCanvas() {
	var apCanvas = document.getElementById('opt-apCanvas');
	var apCtx = apCanvas.getContext('2d');
	apCtx.clearRect(0, 0, apCanvas.width, apCanvas.height);

	var apCanvas = document.getElementById('radar-apCanvas');
	var apCtx = apCanvas.getContext('2d');
	apCtx.clearRect(0, 0, apCanvas.width, apCanvas.height);
}

function clearFloorplanCanvas() {
	var floorplanCanvas = document.getElementById('opt-floorplanCanvas');
	var floorplanCtx = floorplanCanvas.getContext('2d');
	floorplanCtx.clearRect(0, 0, floorplanCanvas.width, floorplanCanvas.height);

	var floorplanCanvas = document.getElementById('radar-floorplanCanvas');
	var floorplanCtx = floorplanCanvas.getContext('2d');
	floorplanCtx.clearRect(0, 0, floorplanCanvas.width, floorplanCanvas.height);
}

function resetCanvases() {
	clearLinkCanvas();
	clearAPCanvas();
	clearFloorplanCanvas();
	var rfVisualPlanHeight = 0;
	document.getElementById('opt-visualPlan').setAttribute('style', 'height:' + rfVisualPlanHeight + 'px');
	document.getElementById('opt-visualPlan').style.height = rfVisualPlanHeight + 'px';

	document.getElementById('radar-visualPlan').setAttribute('style', 'height:' + rfVisualPlanHeight + 'px');
	document.getElementById('radar-visualPlan').style.height = rfVisualPlanHeight + 'px';
}

/*  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
	VRF UI functions
------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

function changeBand() {
	currentAP = null;
	updateChannelSelector();
	drawAPsOnFloorplan();
}

function changeChannel() {
	currentAP = null;
	drawAPsOnFloorplan();
}

function updateChannelSelector() {
	var band = document.getElementById('neighbourbandselector').value;
	select = document.getElementById('neighbourchannelselector');
	select.options.length = 0;
	$('#neighbourchannelselector').append($('<option>', { value: 'All', text: 'All' }));
	var channels = vrfChannels[band];
	$.each(channels, function() {
		if (this !== '') $('#neighbourchannelselector').append($('<option>', { value: this, text: this }));
	});
	$('#neighbourchannelselector').selectpicker('refresh');
	$('#neighbourchannelselector').selectpicker('val', 'All');
}

function loadBuildingSelector() {
	// remove old data from the selector
	var selectOpt = document.getElementById('opt-buildingselector');
	selectOpt.options.length = 0;
	var selectRadar = document.getElementById('radar-buildingselector');
	selectRadar.options.length = 0;

	vrfBuildings.sort((a, b) => {
		const siteA = a.building_name.toUpperCase(); // ignore upper and lowercase
		const siteB = b.building_name.toUpperCase(); // ignore upper and lowercase
		// Sort on Site Name
		if (siteA < siteB) {
			return -1;
		}
		if (siteA > siteB) {
			return 1;
		}
		return 0;
	});

	$.each(vrfBuildings, function() {
		// Add group to the dropdown selector
		$('#opt-buildingselector').append($('<option>', { value: this['building_id'], text: this['building_name'] }));
		$('#radar-buildingselector').append($('<option>', { value: this['building_id'], text: this['building_name'] }));
		$('#opt-buildingselector').selectpicker('refresh');
		$('#radar-buildingselector').selectpicker('refresh');
	});
}

function loadFloorSelector() {
	// remove old data from the selector
	var selectOpt = document.getElementById('opt-floorselector');
	selectOpt.options.length = 0;
	var selectRadar = document.getElementById('radar-floorselector');
	selectRadar.options.length = 0;

	vrfFloors.sort((a, b) => {
		const floorA = a.floor_level; // ignore upper and lowercase
		const floorB = b.floor_level; // ignore upper and lowercase
		// Sort on Site Name
		if (floorA > floorB) {
			return -1;
		}
		if (floorA < floorB) {
			return 1;
		}
		return 0;
	});

	$.each(vrfFloors, function() {
		// Add floors to the dropdown selector
		$('#opt-floorselector').append($('<option>', { value: this['floor_id'], text: this['floor_name'] }));
		$('#radar-floorselector').append($('<option>', { value: this['floor_id'], text: this['floor_name'] }));
		$('#opt-floorselector').selectpicker('refresh');
		$('#radar-floorselector').selectpicker('refresh');
	});
}

/*  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
	Pathloss Drawing functions
------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
function drawApLinks(serial) {
	var band = document.getElementById('neighbourbandselector').value;
	storedAP = findDeviceInMonitoring(serial);
	var bandPathLoss = rfNeighbours[band];
	var foundNeighbours = [];

	var radioMac = null;
	if (band == 2) band = 2.4;
	$.each(storedAP.radios, function() {
		if (this.radio_name.includes(band + ' GHz')) radioMac = this['macaddr'];
	});

	$.each(bandPathLoss, function() {
		if (this['reporting_mac'] === radioMac) foundNeighbours.push(this);
	});
	findAPsForPathloss(foundNeighbours);
}

function findAPsForPathloss(response) {
	$.each(response, function() {
		var ap = findAPForRadio(this['nbr_mac']);
		if (ap) {
			var apSerial = ap['serial'];
			var pathLoss = this['pathloss'];
			if (ap && vrfSelectedAPs[apSerial]) {
				$.each(vrfAPs, function() {
					if (this['serial_number'] === ap['serial']) {
						draw_PL(storedAP['serial'], ap['serial'], pathLoss);
					}
				});
			}
		}
	});
}

function draw_PL(fromAP, toAP, pathLoss) {
	var fromAPVRFData;
	var toAPVRFData;
	$.each(vrfAPs, function() {
		if (this['serial_number'] === fromAP) fromAPVRFData = this;
		else if (this['serial_number'] === toAP) toAPVRFData = this;
	});

	var canvas = document.getElementById('opt-floorplanCanvas');
	var linkCanvas = document.getElementById('opt-linkCanvas');
	var ctx = linkCanvas.getContext('2d');

	// Figure out position of APs
	x1 = (fromAPVRFData.x / currentFloor['floor_width']) * (canvas.width / ratio);
	y1 = (fromAPVRFData.y / currentFloor['floor_length']) * (canvas.height / ratio);
	x2 = (toAPVRFData.x / currentFloor['floor_width']) * (canvas.width / ratio);
	y2 = (toAPVRFData.y / currentFloor['floor_length']) * (canvas.height / ratio);

	// Figure out center for text
	x_center = (x1 + x2) / 2;
	y_center = (y1 + y2) / 2;

	// choose pathloss colour
	var strokeColour = 'black';
	if (pathLoss < 70) strokeColour = '#87CB16';
	else if (pathLoss < 90) strokeColour = '#FFA534';
	else if (pathLoss < 110) strokeColour = '#FB404B';

	// Draw Line
	ctx.strokeStyle = strokeColour;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.stroke();

	pl_size = ctx.measureText(pathLoss);
	ctx.strokeStyle = 'black';
	ctx.shadowColor = 'black';
	ctx.shadowBlur = 2;
	ctx.fillStyle = 'white';
	//ctx.fillRect(x - ap_name_size.width / 2 - 3, y + 10, ap_name_size.width + 6, 14);
	ctx.fillRect(x_center - pl_size.width / 2 - 3, y_center - 4, pl_size.width + 6, 14);

	ctx.shadowBlur = 0;
	ctx.fillStyle = 'black';
	ctx.fillText(pathLoss, x_center - pl_size.width / 2, y_center + 6);
	//ctx.fillText(pathLoss, x_center, y_center);
}

function updateSizes(drawingLocation, width, height) {
	if (drawingLocation === VisualLocation.Optimization) {
		var canvas = document.getElementById('opt-floorplanCanvas');
		canvas.width = width * ratio;
		canvas.height = height * ratio;
		canvas.style.width = width + 'px';
		canvas.style.height = height + 'px';
		canvas.getContext('2d').scale(ratio, ratio);

		var linkCanvas = document.getElementById('opt-linkCanvas');
		linkCanvas.width = width * ratio;
		linkCanvas.height = height * ratio;
		linkCanvas.style.width = width + 'px';
		linkCanvas.style.height = height + 'px';
		linkCanvas.getContext('2d').scale(ratio, ratio);

		var apCanvas = document.getElementById('opt-apCanvas');
		apCanvas.width = width * ratio;
		apCanvas.height = height * ratio;
		apCanvas.style.width = width + 'px';
		apCanvas.style.height = height + 'px';
		apCanvas.getContext('2d').scale(ratio, ratio);

		var rfVisualPlanHeight = height + 20;
		document.getElementById('opt-visualPlan').setAttribute('style', 'height:' + rfVisualPlanHeight + 'px');
		document.getElementById('opt-visualPlan').style.height = rfVisualPlanHeight + 'px';
	} else if (drawingLocation === VisualLocation.Radar) {
		var canvas = document.getElementById('radar-floorplanCanvas');
		canvas.width = width * ratio;
		canvas.height = height * ratio;
		canvas.style.width = width + 'px';
		canvas.style.height = height + 'px';
		canvas.getContext('2d').scale(ratio, ratio);

		var apCanvas = document.getElementById('radar-apCanvas');
		apCanvas.width = width * ratio;
		apCanvas.height = height * ratio;
		apCanvas.style.width = width + 'px';
		apCanvas.style.height = height + 'px';
		apCanvas.getContext('2d').scale(ratio, ratio);

		var rfVisualPlanHeight = height + 20;
		document.getElementById('radar-visualPlan').setAttribute('style', 'height:' + rfVisualPlanHeight + 'px');
		document.getElementById('radar-visualPlan').style.height = rfVisualPlanHeight + 'px';
	}
}
