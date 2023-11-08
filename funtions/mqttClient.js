const { writeTagTotal } = require('./writeTagTotal')
const { MqttClient } = require("mqtt");
const mqtt = require("mqtt");
const pcname = require('os');

const topic = 'returns/Bastian/scanner/Clarify/#'

const client = mqtt.connect("mqtt://dmv1maniot01", {
  clientId: (pcname.hostname()+'client1'),
});



const clientmqtt = () => {


client.on('connect', () => {
    
    console.log('Connected')
    client.subscribe([topic], () => {
      //console.log(`Subscribe to topic '${topic}'`)
    })
  })



client.on('message', (topic, payload) => {
        if (topic === 'returns/Bastian/scanner/Clarify/Total Clarify')
        writeTagTotal(payload);

        console.log('Received Message:', topic, payload.toString())
        //writeTagClarify(topic, payload);
      })

    };


    module.exports = { clientmqtt }

