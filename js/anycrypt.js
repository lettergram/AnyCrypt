
var username = "";
var passphrase = "";
var friend_list = new Array();
var copied_private_key = "";

/**                                             
 *  Loads friends saved in chromes local memory
 */
var loadAnyCryptData = function() {

    // create a deferred object
    var r = $.Deferred();
    
    chrome.storage.local.get("anycrypt", function(items) {
	if (chrome.runtime.error) {
	    console.log("Chrome runtime error");
	}
	try{
	    // Import data from chrome local storage
	    if(items.anycrypt.friends != null){
		friend_list = items.anycrypt.friends;
	    }
	    if(items.anycrypt.username != null){
		username = items.anycrypt.username;
	    }
	    if(items.anycrypt.passphrase != null){
		passphrase = items.anycrypt.passphrase;
	    }
	    if(items.anycrypt.copied_private_key != null){
		copied_private_key = items.anycrypt.copied_private_key;
	    }
	}catch(err){
	    console.log(err);
	}
    });
    
    setTimeout(function () {
	r.resolve();
    }, 2500);
    
    // return the deferred object
    return r;
}

var runLoaderBar = function(){
    var elem = document.getElementById("loader");
    elem.src = chrome.extension.getURL("images/page-loader.gif");
}

// Searches keybase for friends 
var findFriendsOnKeybase = function(input_friend_array) {

    var output_friend_array = [];
    var friend_hash = {};
    var type_of_query = ["usernames", "domain", "twitter", "github", "reddit", "hackernews"];
    
    for(var i = 0; i < input_friend_array.length; i++){

	for(var j=0; j < type_of_query.length; j++){

	    query_data = {};
	    query_data[type_of_query[j]] = input_friend_array[i].toLowerCase();

	    if(!(input_friend_array[i].toLowerCase() in friend_hash)){
		$.ajax({
		    async: false,
		    type:'GET',
		    url: 'https://keybase.io/_/api/1.0/user/lookup.json',
		    data: query_data,
		    dataType: "json",
		    success: function(user) {
			if(user.them && user.them[0] && user.them[0].basics){
			    friend_hash[user.them[0].basics.username] = type_of_query[j];
			}
		    },
		    error: function(request, stats, err) {
			console.log(err + status);
		    }
		});
	    }
	}
    }
    
    for(friend in friend_hash){
	output_friend_array.push(friend);
    }

    return output_friend_array;
}

$(document).ready(function(){

    runLoaderBar();
    var submitButton = document.getElementById("submit");
    var friendEnter = document.getElementById("friends");

    friendEnter.onkeyup = function(event) {
	event = event || window.event;
	if(event.keyCode == 13){
	    submitButton.click();
	}
    }
    

    submitButton.onclick = function(){

	anycrypt_data = {};
	var friendEle = document.getElementById("friends").value.replace(/\s+/g, '');
	friendEle = friendEle.replace(/(?:\r\n|\r|\n)/g, '');
	anycrypt_data["friends"] = findFriendsOnKeybase(friendEle.split(','));
	anycrypt_data["username"] = document.getElementById("username").value;
	anycrypt_data["passphrase"] = document.getElementById("passphrase").value;
	anycrypt_data["copied_private_key"] = document.getElementById("copied_private_key").value;
	
	console.log(document.getElementById("copied_private_key").value.length);

	document.getElementById("submit").innerHTML = "Submitted!";

	// Save it using the Chrome extension storage API.
	chrome.storage.local.set({'anycrypt': anycrypt_data}, function() {
	    if (chrome.runtime.error) {
		console.log("Storage Save: Runtime error.");
	    }else{
		console.log("Successfully stored anycrypt_data");
		console.log(anycrypt_data);
	    }
	});

	chrome.runtime.sendMessage({
	    type: 'page',
	    request: "data"
	});
	location.reload();
    }
    
    loadAnyCryptData().done(function(){
	document.getElementById("loading-bar").innerHTML = "";
	document.getElementById("settings").style.display = 'block';
	document.getElementById("username").value = username;
	document.getElementById("friends").value = friend_list.toString().replace(/,/g, ", ");
	document.getElementById("copied_private_key").value = copied_private_key;
	document.getElementById("passphrase").value = passphrase;
    });
});
