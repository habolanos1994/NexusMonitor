var mqtt;
var reconnectTimeout = 2000;

var host = "pcv1engmqtt01"; // the hostname of your broker
var port = 8083; // the port of your broker
var clientId = "client" + new Date().getTime();

function onConnect() {
    // Once a connection has been made, make a subscription and send a message.
    console.log("Connected");
    mqtt.subscribe("ELP/Returns/Receiving/#");
    mqtt.subscribe("ELP/Returns/Bastian/#");
}

function onMessageArrived(message) {
    console.log("Message Arrived: " + message.payloadString);
    var table = document.getElementById("mqttTable");

    // Check if a row with the topic already exists
    for (var i = 1, row; (row = table.rows[i]); i++) {
        if (row.cells[0].innerText == message.destinationName) {
            // If row with topic exists, replace the message and exit the function
            try {
                var formattedMessage = JSON.stringify(JSON.parse(message.payloadString), null, 2);
                row.cells[1].innerHTML = "<pre>" + formattedMessage + "</pre>";
            } catch (e) {
                console.error("Invalid JSON received: ", message.payloadString);
            }
            return;
        }
    }
    // If no existing row with the topic was found, create a new row
    var row = table.insertRow(-1);
    var cell1 = row.insertCell(0);
    var cell2 = row.insertCell(1);

    try {
        var formattedMessage = JSON.stringify(JSON.parse(message.payloadString), null, 2);
        cell1.innerHTML = message.destinationName;
        cell2.innerHTML = "<pre>" + formattedMessage + "</pre>";
    } catch (e) {
        console.error("Invalid JSON received: ", message.payloadString);
    }
}

function onFailure(message) {
    console.log("Connection Attempt to Host " + host + " Failed");
    setTimeout(MQTTconnect, reconnectTimeout);
}

function MQTTconnect() {
    console.log("Connecting to " + host + " " + port);
    var options = {
        clientId: clientId,
        protocol: "wss",
        hostname: host,
        port: port,
        path: "/mqtt", // The path of your MQTT broker's WebSocket endpoint
        useSSL: true,
        ca: [ // Add the content of your certificate_chain.pem file here
            '-----BEGIN CERTIFICATE-----',
            '...',
            '-----END CERTIFICATE-----'
        ],
        rejectUnauthorized: true
    };
    mqtt = new Paho.MQTT.Client(options.hostname, options.port, options.path, options.clientId);
    // Set callback handlers
    mqtt.onMessageArrived = onMessageArrived;

    // Connect the client
    mqtt.connect({
        onSuccess: onConnect,
        onFailure: onFailure,
        useSSL: options.useSSL,
        timeout: 3,
        mqttVersion: 4,
        userName: "", // Add your username if required
        password: "" // Add your password if required
    });
}

// Connect on page load
MQTTconnect();
