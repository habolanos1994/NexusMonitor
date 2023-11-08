const mqtt = require("mqtt");
const { v4: uuidv4 } = require('uuid');


const os = require('os');
const hostname = os.hostname();

const options = {
  host: "pcv1engmqtt01",
  port: 1883,
  protocol: "mqtt",
  rejectUnauthorized: false,
  clientId: `client${hostname}PLC${uuidv4()}`
};

const client = mqtt.connect(options);

let seq = 0;

function mqttpub(topic, message, bn){
  const payload = {
    bn: bn,
    Host: hostname,
    mid: uuidv4(),
    ts: new Date(),
    seq: seq++,
    ...message
  };
  //console.log(payload)
  client.publish(topic, JSON.stringify(payload), { qos: 1 });
  seq = (seq + 1) % 10000;
}

module.exports = { mqttpub };


