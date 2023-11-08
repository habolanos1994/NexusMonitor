const { ControllerManager, Controller, TagGroup, TagList} = require("st-ethernet-ip");
const { mqttpub } = require('./mqttpublish');
const { v4: uuidv4 } = require('uuid');

const cm = new ControllerManager();
const controller = new Controller();

const tags32 = [
  ["MARK001.Out_Running", "MARKS1"],
  ["MARK002.Out_Running", "MARKS2"],
  ["MARK003.Out_Running", "MARKS3"],
  // ... add more tags as needed
];

const tagValues = [];

async function readTagsAndPublish() {
  try {
    await controller.connect('10.63.192.32'); // Replace with your PLC IP address
    const tagGroup = new TagGroup();
    const tagList = new TagList();

    for (const [tagName, tagDisplayName] of tags32) {
      const tag = await controller.newTag(tagName);
      tag.displayName = tagDisplayName;
      tagList.add(tag);
    }

    tagGroup.add(tagList);

    const values = await controller.readTag(tagGroup);

    for (const [index, tag] of tagList.tags.entries()) {
      const value = values[tag.id];
      tagValues.push([tag.displayName, value.value, value.type]);
    }

    mqttpub('topic', JSON.stringify({
      plc: 'plcname',
      status: 'working', // replace with your status
      id: uuidv4(),
      data: tagValues,
    }));

  } catch (error) {
    console.error(error);
    mqttpub('topic', JSON.stringify({
      plc: 'plcname',
      status: 'fail', // replace with your status
      id: uuidv4(),
      data: [],
    }));
  } finally {
    await controller.disconnect();
  }
}

// Schedule the task to run every minute
schedule.scheduleJob('*/5 * * * *', readTagsAndPublish);
