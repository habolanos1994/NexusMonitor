const { ControllerManager, Controller, TagGroup, TagList} = require("st-ethernet-ip");
const encoder = new TextDecoder('utf-8')
const schedule = require('node-schedule');
const { mqttpub } = require('./mqttpublish')
let cm = new ControllerManager();
let rule = new schedule.RecurrenceRule();
let rule2 = new schedule.RecurrenceRule();
const regex = /[.]/g;

let date_ob = new Date();

// current date
// adjust 0 before single digit date
let date = ("0" + date_ob.getDate()).slice(-2);

// current month
let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);

// current year
let year = date_ob.getFullYear();

// current hours
let hours = date_ob.getHours();

// current minutes
let minutes = date_ob.getMinutes();

rule.hour = 4;
rule.minute = 00;

rule2.hour = 15;
rule2.minute = 30;


let tags33 = [
  ["AEC_BO1_GL", "BOX 1 Running"]
  ,["AEC_BO1_RL", "BOX 1 Stop"]
  ,["AEC_BO2_GL", "BOX 2 Running"]
  ,["AEC_BO2_RL", "BOX 2 Stop"]
  ,["Barcode_string_AEC1", "Barcode 1"]
  ,["AEC_BOX2_Runtime_min", "BOX 2 Runtime"]
  ,["AEC_BOX1_Runtime_min", "BOX 1 Runtime"]
  ,["AEC_BOX2_Stop_min", "BOX 2 Stoptime"]
  ,["AEC_BOX1_Stop_min", "BOX 1 Stoptime"]

]

let AEC1 = "10.63.192.33"

let cont33 = cm.addController(AEC1, 0, 250, true, 1000, {})


let PLC = new Controller({});

BOXfilterflat = tags33.flat()


let BOXfilter = BOXfilterflat.filter(BOXfilterflat => BOXfilterflat.includes("AEC_BOX2_"))

const job2 = schedule.scheduleJob(rule2, async () => {
  for (let index = 0; index < BOXfilter.length; ) {
    const element = BOXfilter[index];
    const tagm = PLC.newTag(element);
    await PLC.readTag(tagm);

    sendData = JSON.stringify(tagm.value)
    sendData2 = Number(sendData)
    regex2 = Number(element.search(regex))
    elementfilter = element.slice(0,regex2)

     if (tagm.value == null) {

      console.log(tagm)

  } else {
    await sql.post_box_counter('BOX_OPENER_data',elementfilter,sendData2)
    index++
    tagm.value = "0";
    PLC.writeTag(tagm);
  }
   
  }
});


const job = schedule.scheduleJob(rule, async () => {
  for (let index = 0; index < BOXfilter.length; ) {
    const element = BOXfilter[index];
    const tagm = PLC.newTag(element);
    await PLC.readTag(tagm);

    sendData = JSON.stringify(tagm.value)
    sendData2 = Number(sendData)
    regex2 = Number(element.search(regex))
    elementfilter = element.slice(0,regex2)

     if (tagm.value == null) {
      console.log(tagm)
  } else {
    await sql.post_box_counter('BOX_OPENER_data',elementfilter,sendData2)
    index++
    tagm.value = "0";
    PLC.writeTag(tagm);
  }
   
  }
});


PLC.connect(AEC1, 0).then(async () => {
console.log("connecte async")

cont33.on("TagChanged", (tag, prevValue) => {


  if (tag.displayName === "Barcode 1") {
  
    mqttpub("returns/Bastian/scanner/AEC/" + tag.displayName, tag.value)
  }

  if (tag.value)
  topic=("returns/AEC/Status/" + tag.displayName.slice(0, 5)).toString()
  message = (tag.displayName.slice(6)).toString()
  mqttpub(topic, message)

});


  

cont33.on("Connected", () => {
  mqttpub("returns/OnlinePLC/AEC1/Status", "Connected")
});

cont33.on("Error", (err) => {
  message = err.toString()
  mqttpub("returns/OnlinePLC/AEC1/Status", message)
});


cont33.connect();

}).catch(async e => {
    console.log(e)
    console.log("error")
});


for (let index = 0; index < tags33.length; index++) {
  if (index === 0 ) {
    console.log("adding tags")
    console.log(year + "-" + month + "-" + date + " " + hours + ":" + minutes);
  } 
    arraytagindex = tags33[index][0].toString()
    arraydisplaytagindex = tags33[index][1].toString()
    cont33.addTag(String(arraytagindex),String(arraydisplaytagindex))
    
}