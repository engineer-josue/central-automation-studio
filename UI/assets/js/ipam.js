/*
Central Automation v1.7.5
Updated: 1.8.2
Copyright Aaron Scott (WiFi Downunder) 2021-2023
*/

const innerPoolType = 'INNER_IP_POOL_TYPE';
const dhcpPoolType = 'DHCP_POOL_TYPE';

var systemInfo = [];
var dhcpInfo = [];
var systemPools = [];
var dhcpPools = [];
var pools = {};
var config = {};

var poolsPromise;
var configPromise;

var configNotification;
var poolNotification;
var allocationsNotification;

/*  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
		Global functions
	------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
function loadCurrentPageAP() {
	poolsPromise = new $.Deferred();
	configPromise = new $.Deferred();
	$.when(getPoolConfig()).then(function() {
		// , getIPPools()
		getIPAllocations();
	});
	$('[data-toggle="tooltip"]').tooltip();
}

function getPoolConfig() {
	configNotification = showNotification('ca-hierarchy-55', 'Getting Pool Configurations...', 'bottom', 'center', 'info');
	config = {};
	pools = {};
	systemPools = [];
	dhcpPools = [];

	var settings = {
		url: getAPIURL() + '/tools/getCommandwHeaders',
		method: 'POST',
		timeout: 0,
		headers: {
			'Content-Type': 'application/json',
		},
		data: JSON.stringify({
			url: localStorage.getItem('base_url') + '/ipms-config/v1/node_list/GLOBAL/GLOBAL/config/',
			access_token: localStorage.getItem('access_token'),
		}),
	};

	$.ajax(settings).done(function(commandResults, statusText, xhr) {
		if (commandResults.hasOwnProperty('headers')) {
			updateAPILimits(JSON.parse(commandResults.headers));
		}
		if (commandResults.hasOwnProperty('status') && commandResults.status === '503') {
			logError('Central Server Error (503): ' + commandResults.reason + ' (/ipms-config/v1/node_list/GLOBAL/GLOBAL/config/)');
			apiErrorCount++;
			return;
		} else if (commandResults.hasOwnProperty('error_code')) {
			logError(commandResults.description);
			apiErrorCount++;
			return;
		}
		var response = JSON.parse(commandResults.responseBody);

		$.each(response['address_pool'], function() {
			var poolname = this['pool_id'].toString();
			config[poolname] = this;

			pools[poolname] = this;

			if (this['pool_type'] === innerPoolType) {
				systemPools.push(this);
			} else if (this['pool_type'] === dhcpPoolType) {
				dhcpPools.push(this);
			}
		});
		console.log(config);
		configNotification.close();
		configPromise.resolve();
	});
	return configPromise.promise();
}

function getIPPools() {
	poolNotification = showNotification('ca-hierarchy-55', 'Getting IP Pools...', 'bottom', 'center', 'info');
	pools = {};
	systemPools = [];
	dhcpPools = [];

	var settings = {
		url: getAPIURL() + '/tools/getCommandwHeaders',
		method: 'POST',
		timeout: 0,
		headers: {
			'Content-Type': 'application/json',
		},
		data: JSON.stringify({
			url: localStorage.getItem('base_url') + '/ipmsapi/v1/pool',
			access_token: localStorage.getItem('access_token'),
		}),
	};

	$.ajax(settings).done(function(commandResults, statusText, xhr) {
		if (commandResults.hasOwnProperty('headers')) {
			updateAPILimits(JSON.parse(commandResults.headers));
		}
		if (commandResults.hasOwnProperty('status') && commandResults.status === '503') {
			logError('Central Server Error (503): ' + commandResults.reason + ' (/ipmsapi/v1/pool)');
			apiErrorCount++;
			return;
		} else if (commandResults.hasOwnProperty('error_code')) {
			logError(commandResults.description);
			apiErrorCount++;
			return;
		}
		console.log(commandResults);
		var response = JSON.parse(commandResults.responseBody);

		$.each(response['pools'], function() {
			var poolname = this['name'].toString();
			pools[poolname] = this;

			if (this['type'] === innerPoolType) {
				systemPools.push(this);
			} else if (this['type'] === dhcpPoolType) {
				dhcpPools.push(this);
			}
		});
		//console.log(systemPools);
		poolNotification.close();
		poolsPromise.resolve();
	});
	return poolsPromise.promise();
}

function getIPAllocations() {
	allocationsNotification = showNotification('ca-check-list', 'Getting IP Allocations...', 'bottom', 'center', 'info');
	systemInfo = [];
	dhcpInfo = [];
	var settings = {
		url: getAPIURL() + '/tools/getCommandwHeaders',
		method: 'POST',
		timeout: 0,
		headers: {
			'Content-Type': 'application/json',
		},
		data: JSON.stringify({
			url: localStorage.getItem('base_url') + '/ipms/v1/debug/db/allocation?cid=bdb7b953a1ed41d4bf34ec828c3d0a3d&pool_id=200000',
			access_token: localStorage.getItem('access_token'),
		}),
	};

	$.ajax(settings).done(function(commandResults, statusText, xhr) {
		if (commandResults.hasOwnProperty('headers')) {
			updateAPILimits(JSON.parse(commandResults.headers));
		}
		if (commandResults.hasOwnProperty('status') && commandResults.status === '503') {
			logError('Central Server Error (503): ' + commandResults.reason + ' (/ipmsapi/v1/allocation)');
			apiErrorCount++;
			return;
		} else if (commandResults.hasOwnProperty('error_code')) {
			logError(commandResults.description);
			apiErrorCount++;
			return;
		}
		console.log(commandResults);
		var response = JSON.parse(commandResults.responseBody);
		var allocations = response['device_allocations'];

		$.each(allocations, function() {
			if (this['pool_type'] === innerPoolType) {
				systemInfo.push(this);
			} else if (this['pool_type'] === dhcpPoolType) {
				dhcpInfo.push(this);
			}
		});

		loadSystemTables();
		loadDHCPTables();

		allocationsNotification.close();
	});

	loadSystemTables();
	loadDHCPTables();

	allocationsNotification.close();
}

/*  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
		System functions
	------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

function loadSystemTables() {
	$('#system-pool-table')
		.DataTable()
		.rows()
		.remove();
	$.each(systemPools, function() {
		var apiURL = localStorage.getItem('base_url');
		var centralURL = centralURLs[0][apiURL] + '/frontend/#IPMS/SYSTEMIPPOOL?nc=global';

		var progress = 0; //Math.round((this['used_to_total'][0] / this['used_to_total'][1]) * 100);

		var progressTheme = 'progress-bar-success';
		if (progress > 70 && progress < 90) progressTheme = 'progress-bar-warning';
		else if (progress >= 90) progressTheme = 'progress-bar-danger';

		var progressBar = '<div class="progress"><div class="progress-bar ' + progressTheme + '" role="progressbar" aria-valuenow="' + progress + '" aria-valuemin="0" aria-valuemax="100" style="width: ' + progress + '%;"><span class="progress-percentage" >' + progress + '% Allocated</span></div></div>';

		var poolName = this.pool_name;

		// Add pool to table
		var table = $('#system-pool-table').DataTable();
		table.row.add(['<a href="' + centralURL + '" target="_blank"><strong>' + poolName + '</strong></a>', this['ip_range'][0]['start_ip'] + ' - ' + this['ip_range'][0]['end_ip'], progressBar]);
	});
	$('#system-pool-table')
		.DataTable()
		.rows()
		.draw();

	$('#system-table')
		.DataTable()
		.rows()
		.remove();
	$.each(systemInfo, function() {
		var deviceInfo = findDeviceInMonitoring(this['serial']);
		var name = this['serial'];
		if (deviceInfo) name = deviceInfo['name'];

		// Make AP Name as a link to Central
		name = encodeURI(name);
		var apiURL = localStorage.getItem('base_url');
		var centralURL = centralURLs[0][apiURL] + '/frontend/#/APDETAILV2/' + this['serial'] + '?casn=' + this['serial'] + '&cdcn=' + name + '&nc=access_point';
		var poolURL = centralURLs[0][apiURL] + '/frontend/#IPMS/SYSTEMIPPOOL?nc=global';

		var poolName = config[this['pool_id']].pool_name;

		// Add allocation to table
		var table = $('#system-table').DataTable();
		table.row.add(['<a href="' + centralURL + '" target="_blank"><strong>' + name + '</strong></a>', this['serial'], deviceInfo['macaddr'], '<a href="' + poolURL + '" target="_blank"><strong>' + poolName + '</strong></a>', this['config']['subnet'], this['config']['mask'], deviceInfo['site'], deviceInfo['group_name']]);
	});
	$('#system-table')
		.DataTable()
		.rows()
		.draw();
}

/*  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
		DHCP functions
	------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

function loadDHCPTables() {
	$('#dhcp-pool-table')
		.DataTable()
		.rows()
		.remove();
	$.each(dhcpPools, function() {
		var apiURL = localStorage.getItem('base_url');
		var centralURL = centralURLs[0][apiURL] + '/frontend/#IPMS/SHAREDDHCPPOOL?nc=global';

		var progress = 0; //Math.round((this['used_to_total'][0] / this['used_to_total'][1]) * 100);

		var progressTheme = 'progress-bar-success';
		if (progress > 70 && progress < 90) progressTheme = 'progress-bar-warning';
		else if (progress >= 90) progressTheme = 'progress-bar-danger';

		var progressBar = '<div class="progress"><div class="progress-bar ' + progressTheme + '" role="progressbar" aria-valuenow="' + progress + '" aria-valuemin="0" aria-valuemax="100" style="width: ' + progress + '%;"><span class="progress-percentage" >' + progress + '% Allocated</span></div></div>';

		var poolName = this.pool_name;

		// Add pool to table
		var table = $('#dhcp-pool-table').DataTable();
		table.row.add(['<a href="' + centralURL + '" target="_blank"><strong>' + poolName + '</strong></a>', this['ip_range'][0]['start_ip'] + ' - ' + this['ip_range'][0]['end_ip'], this.max_clients, progressBar]);
	});
	$('#dhcp-pool-table')
		.DataTable()
		.rows()
		.draw();

	$('#dhcp-table')
		.DataTable()
		.rows()
		.remove();
	$.each(dhcpInfo, function() {
		var deviceInfo = findDeviceInMonitoring(this['serial']);
		console.log();
		var name = this['serial'];
		if (deviceInfo) name = deviceInfo['name'];

		var poolInfo = pools[this['pool_id']];

		// Make AP Name as a link to Central
		name = encodeURI(name);
		var apiURL = localStorage.getItem('base_url');
		var centralURL = centralURLs[0][apiURL] + '/frontend/#/APDETAILV2/' + this['serial'] + '?casn=' + this['serial'] + '&cdcn=' + name + '&nc=access_point';
		var poolURL = centralURLs[0][apiURL] + '/frontend/#IPMS/SHAREDDHCPPOOL?nc=global';

		var poolName = config[this['pool_id']].pool_name;

		// Add allocation to table
		var table = $('#dhcp-table').DataTable();
		table.row.add([
			'<a href="' + centralURL + '" target="_blank"><strong>' + name + '</strong></a>',
			this['serial'],
			deviceInfo['macaddr'],
			'<a href="' + poolURL + '" target="_blank"><strong>' + poolName + '</strong></a>',
			this['config']['subnet'],
			this['config']['mask'],
			//poolInfo["pool_config"]["11"]["hosts"],
			deviceInfo['site'],
			deviceInfo['group_name'],
		]);
	});
	$('#dhcp-table')
		.DataTable()
		.rows()
		.draw();
}
