var username = "";
var user_passphrase = "";
var user_key = {};
var copied_user_private_key = "";

var ring = new kbpgp.keyring.KeyRing;

var friend_keys = {};
var friend_list = new Array();
var friend_check = {};

/**
 *  Loads friends saved in chromes local memory
 */
var loadAnyCryptData = function() {

    // create a deferred object
    var r = $.Deferred();

    // Import data from chrome storage
    chrome.storage.local.get("anycrypt", function(items) {
	if (chrome.runtime.error)
	    console.log("Chrome runtime error");
	try {
	    if(items.anycrypt.friends != null) {
		friend_list = items.anycrypt.friends;
	    }
	    if(items.anycrypt.username != null) {
		username = items.anycrypt.username;
	    }
	    if(items.anycrypt.passphrase != null){
		user_passphrase = items.anycrypt.passphrase;
	    }
	    if(items.anycrypt.copied_private_key != null){
		copied_user_private_key = items.anycrypt.copied_private_key;
	    }
	}catch(err){
	    console.log(err);
	}
    });

    setTimeout(function () {
	// and call `resolve` on the deferred object, once you're done
	r.resolve();
    }, 2500);

    // return the deferred object
    return r;
}

/**
 * Addition to CryptoJS to enable string to u8array 
 */
CryptoJS.enc.u8array = {

    stringify: function (wordArray) {
	var words = wordArray.words;
	var sigBytes = wordArray.sigBytes;
	var u8 = new Uint8Array(sigBytes);
	for (var i = 0; i < sigBytes; i++) {
	    var byte = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
	    u8[i]=byte;
	}

	return u8;
    },

    parse: function (u8arr) {
	var len = u8arr.length;
	var words = [];
	for (var i = 0; i < len; i++) {
	    words[i >>> 2] |= (u8arr[i] & 0xff) << (24 - (i % 4) * 8);
	}

	return CryptoJS.lib.WordArray.create(words, len);
    }
};

/**
 *  Connect to get user keys
 */
connect = function() {

    kbpgp.KeyManager.import_from_armored_pgp({
	armored: copied_user_private_key
    }, function(err, user) {

	if (!err) {
	    if (user.is_pgp_locked()) {
		user.unlock_pgp({
		    passphrase: user_passphrase
		}, function(err) {
		    if (!err) {
			user_key = user;
			console.log("Loaded private key");
		    }
		});
	    } else {
		user_key = user;
		console.log("Loaded private key w/o passphrase");
	    }
	}else{
	    console.log(err);
	}
    });
}

/**
 *  Send message to selected test
 */
sendMessage = function(data) {

    var message = ""
    
    if(data.decrypted_message){
	message = data.decrypted_message;
    }else{
	message = data.encrypted_message;
    }

    chrome.tabs.query(
	{ currentWindow: true, active: true },
	function (tab) {
	    chrome.tabs.sendRequest(tab[0].id, message);
	}
    );
}

/**
 *  Encrypt the message
 */ 
encrypt = function (id, message) {

    var params = {
	msg:         message,
	encrypt_for: [friend_keys[id], user_key]
    };

    if(user_key){
	params["sign_with"] = user_key;
    }

    kbpgp.box(params, function(err, result_string, result_buffer) {
	if(!err){
	    data = {}
	    data["encrypted_message"] = result_string.replace(new RegExp("\n", "g"), "zzz\n");
	    sendMessage(data);
	}else{
	    console.log(err);
	}
    });
}

/**
 *  Decrypt the encrypted string
 *  
 *  encrypted - Encrypted string
 *  Callback function
 */
decrypt = function(encrypted, sendResponse) {

    
    var encrypted_string = encrypted.replace(new RegExp("zzz ", "g"), "\n");
    encrypted_string = encrypted_string.replace(new RegExp("zzz\n", "g"), "\n");
    encrypted_string = encrypted_string.replace(new RegExp("zzz", "g"), "\n");    
    
    var decrypted_string = "";
    var data = {"decrypted_message": "ENCRYPTED MESSAGE: Not for you," };    
    data["decrypted_message"] += "\n or you need add sender to your AnyCrypt friends";

    data["encrypted_message"] = encrypted_string; // encrypted string added for reference

    kbpgp.unbox({keyfetch: ring, armored: encrypted_string}, function(err, literals) {
	
	if (err != null) {
	    data["error"] = true;
	    sendResponse(data);
	    return console.log("Problem: " + err);
	} else {
	    try{
		var ds = km = null;
		ds = literals[0].get_data_signer();
	    }catch(err){
		console.log(err);
		return;
	    }
	    
	    if (ds) { km = ds.get_key_manager(); }
	    
	    // Get signed by name
	    if (km) {		
		console.log("Signed by PGP fingerprint");
		try{
		    data["fingerprint"] = km.get_pgp_fingerprint().toString('hex');
		    data["signed_by"] = km.userids[0].components.email.split("@")[0];
		}catch(err){
		    console.log(err);
		}
	    }
	    
	    decrypted_string = literals[0].toString();
	    
	    if(user_key.is_pgp_locked()){
		console.log("String is locked!!!");
	    }

	    data["decrypted_message"] = decrypted_string;
	    
	    sendResponse(data);
	}
    });
}



function onRequestEncrypt(info, tab) {
    encrypt(info.menuItemId, info.selectionText);
};

function onRequestDecrypt(info, tab) {
    decrypt(info.selectionText, sendMessage);
};

function loadSettings(id) {

    loadAnyCryptData().done(function() {

	connect();
	friend_list.push(username);

	for(var i = 0; i < friend_list.length; i++){
	    if(!friend_check.hasOwnProperty(friend_list[i])) {

		// Generate key for friends
		var title = "Encrypt for " + friend_list[i];
		friend_check[friend_list[i]] = i.toString();

		if(friend_list[i] != username){

		    // AJAX call to get all 
		    $.ajax({
			async: false,
			type: 'GET',
			url: "https://keybase.io/" + friend_list[i] + "/key.asc",
			success: function(public_key) {
			    kbpgp.KeyManager.import_from_armored_pgp({
				armored: public_key
			    }, function(err, key_manager) {
				if (!err) {
				    friend_keys[i] = key_manager;
				    ring.add_key_manager(key_manager);			    
				}else{
				    console.log(err);
				}
			    });
			},
			error: function (request, status, err) {
			    console.log(err + status);
			}
		    });
		}else{
		    ring.add_key_manager(user_key);
		    friend_keys[i] = user_key;
		}
		chrome.contextMenus.create({"id": i.toString(), "parentId": id, "title" : title, "contexts":["selection"], "onclick": onRequestEncrypt });
	    }
	}
    });

}

// Loads settings for application
function loadFriends(info, tab) {
    loadSettings(info.menuItemId);
};

// Add context menu to call encryption
chrome.contextMenus.create({"id": "100", "title": "Encrypt", "contexts":["selection"], "onclick": loadFriends });

// Add context menu to call decryption
chrome.contextMenus.create({"title": "Decrypt Message", "contexts":["selection"], "onclick": onRequestDecrypt });

// Chrome Extension - add listener for message from content script
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {

    if (message && message.type == 'page') {
	var page_message = message.message;
	loadSettings("100");
    }
    
    if (message.encrypted_message) {
	decrypt(message.encrypted_message, sendResponse);
    }
    // Have to return true apparently:
    // https://code.google.com/p/chromium/issues/detail?id=343007#makechanges           
    return true;
});

// Load data from settings, and obtains user_key
loadAnyCryptData().done(function(){
    connect();
});
