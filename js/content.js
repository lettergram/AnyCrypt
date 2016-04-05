
// Set previous search time
var d = new Date();
var previous_time = d.getTime();
var max_time = 0;

/**
 *  Adds listener to onrequest, used to see active elements, and get selections
 *  This replaces nodes for encryption and decryption
 */
chrome.extension.onRequest.addListener(function(request) {
    var sel, range;
    if (window.getSelection) {
	sel = window.getSelection()
	var active_ele = document.activeElement;
	if (sel.rangeCount) {
	    range = sel.getRangeAt(0);
	    range.deleteContents();
	    if(active_ele.tagName == "TEXTAREA" || active_ele.tagName == "INPUT"){
		active_ele.value = request;
	    }else{
		range.insertNode(document.createTextNode(request));
	    }
	}
    } else if (document.selection && document.selection.createRange) {
	range = document.selection.createRange();
	range.text = request;
    }
});

/**
 *  Sends message to background script for decrypt
 */ 
requestDecrypt = function(encrypted_message, element) {
    data = {};
    data["encrypted_message"] = encrypted_message;
    chrome.runtime.sendMessage(data, null, function(response) {
	if(response){

	    element.innerHTML = response.decrypted_message;

	    if(!response.error){
		// Add image for decrypted messages
		img_loc = chrome.extension.getURL('images/owl-headcorner_low32.png');
		img_html = '<img id="keylimepie" src="'+img_loc+'">';
		new_html = img_html + element.innerHTML;
		element.innerHTML = new_html;

		// Add signiture if signed
		if(response.signed_by){
		    element.innerHTML += "<br><i> - Signed: "+response.signed_by+"</i>";
		}
	    }else{
		if(response.encrypted_message){
		    element.innerHTML += "<br><details>"+response.encrypted_message+"</details>";
		}
	    }
	}
    });
}

/**      
 *  Searches for a decrypted message
 */
searchForEncryptedMessages = function() {

    // Find PGP message
    start = "-----BEGIN PGP MESSAGE-----";
    end = "-----END PGP MESSAGE-----";

    var element = document.getElementsByTagName("SPAN");

    for(var i = 0; i < element.length; i ++){

	if(element[i].textContent.indexOf(start) > -1
	   && element[i].textContent.indexOf(end) > -1)
	{
	    var msg = element[i].textContent;
	    var encrypted_message = msg.substring(msg.lastIndexOf(start), msg.lastIndexOf(end)+end.length+4);
	    requestDecrypt(encrypted_message, element[i]);
	}
    }    
}

$(document).ready(function(){
    searchForEncryptedMessages();
    
    // Fire new search for encrypted messages if there is a change to the page
    MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
    
    var observer = new MutationObserver(function(mutations, observer) {

	var clock = new Date();
	var curr_time = clock.getTime();

	var time_diff = curr_time - previous_time
	
	if(time_diff > max_time){
	    console.log("Searching for messages to decrypt");
	    max_time = Math.round((max_time + (time_diff / 4)) % 5000);
	    searchForEncryptedMessages();
	}
	previous_time = curr_time;
    });
    
    observer.observe(document.body, {
	childList: true,
	subtree: true,
   });

});
