/*
Central Automation v1.7.5
Updated: 1.8.2
Aaron Scott (WiFi Downunder) 2022
*/

var groupDeviceList = {};

/*  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
		UI functions
	------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

function loadCurrentPageGateway() {
	showNotification('ca-content-delivery', 'Retrieved all Gateways', 'bottom', 'center', 'success');
	buildGroupDeviceList();
}

function loadCurrentPageGroup() {
	showNotification('ca-folder-settings', 'Retrieved all Groups', 'bottom', 'center', 'success');
	buildGroupDeviceList();
}

function buildGroupDeviceList() {
	var groupList = getGroups();
	var gatewayList = getGateways();
	$.each(groupList, function() {
		if (this.group !== 'unprovisioned') {
			if (this.group_properties.AllowedDevTypes.includes('Gateways')) {
				var groupName = this.group;
				// Add group name to list
				groupDeviceList[groupName] = encodeURI(groupName);

				$.each(gatewayList, function() {
					if (this.group_name === groupName) {
						var visibleName = groupName + ' > ' + this.name;
						groupDeviceList[visibleName] = encodeURI(groupName) + '/' + this.macaddr;
					}
				});
			}
		}
	});

	// load selectPicker with Groups
	select = document.getElementById('groupselector');
	select.options.length = 0;

	var variableGroups = Object.keys(groupDeviceList);
	$.each(variableGroups, function() {
		$('#groupselector').append($('<option>', { value: groupDeviceList[this], text: this }));
		if ($('.selectpicker').length != 0) {
			$('.selectpicker').selectpicker('refresh');
		}
	});
}

/*  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
		Config functions
	------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

function getConfigforSelected() {
	// Do nothing today as this API is allowlisted :(
	/*
	var groupselect = document.getElementById("groupselector");
	var selectedEntity = groupselect.value;
	
	console.log(selectedEntity)
	
	var settings = {
	  "url": getAPIURL() + "/tools/getCommand",
	  "method": "POST",
	  "timeout": 0,
	  "headers": {
		"Content-Type": "application/json"
	  },
	  "data": JSON.stringify({
		"url": localStorage.getItem('base_url') + "/caasapi/v1/configuration/templatebase?group-name=" + selectedEntity,
		"access_token": localStorage.getItem('access_token')
	  })
	};

	$.ajax(settings).done(function (response, statusText, xhr) {
		console.log(response)
		
	});
	*/
}

function confirmCommands() {
	var select = document.getElementById('groupselector');
	var newConfig = document.getElementById('gatewayConfig').value;

	if (select.selectedIndex == 0) {
		showNotification('ca-window-code', 'Please select a Group / Device', 'bottom', 'center', 'danger');
	} else if (newConfig === '') {
		showNotification('ca-window-code', 'Please enter the required CLI commands', 'bottom', 'center', 'danger');
	} else {
		Swal.fire({
			title: 'Are you sure?',
			text: 'Changes will be applied to the selected Group/Device',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#23CCEF',
			cancelButtonColor: '#d33',
			confirmButtonText: 'Yes, do it!',
		}).then(result => {
			if (result.isConfirmed) {
				applyCLICommands();
			}
		});
	}
}

function applyCLICommands() {
	errorCounter = 0;
	clearErrorLog();

	var select = document.getElementById('groupselector');
	var selectedText = select.options[select.selectedIndex].text;
	var currentGroup = select.value;

	var newConfig = document.getElementById('gatewayConfig').value;
	var currentConfig = newConfig.split('\n');

	showNotification('ca-window-code', 'Updating Gateway Config...', 'bottom', 'center', 'info');

	// need to push config back to Central.
	var settings = {
		url: getAPIURL() + '/tools/postCommand',
		method: 'POST',
		timeout: 0,
		headers: {
			'Content-Type': 'application/json',
		},
		data: JSON.stringify({
			url: localStorage.getItem('base_url') + '/caasapi/v1/exec/cmd?group_name=' + currentGroup,
			access_token: localStorage.getItem('access_token'),
			data: JSON.stringify({ cli_cmds: currentConfig }),
		}),
	};

	$.ajax(settings).done(function(response, statusText, xhr) {
		var result = response['_global_result'];
		if (result['status_str'] === 'Success') {
			showNotification('ca-window-code', 'Gateway config for ' + selectedText + ' was successfully updated', 'bottom', 'center', 'success');
		} else {
			logError('Config for ' + selectedText + ' failed to be applied: ' + result['status_str']);
			showLog();
			showNotification('ca-window-code', 'Gateway config for ' + selectedText + ' failed', 'bottom', 'center', 'warning');
		}
	});
}
