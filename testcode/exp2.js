const { Controller } = require('st-ethernet-ip');

const tags32 = [    ['MARK001.Out_Running', 'MARKS1'],
  ['MARK002.Out_Running', 'MARKS2'],
  ['MARK003.Out_Running', 'MARKS3'],
  // add more tags as needed
];

const PLC = new Controller();

PLC.connect('10.63.192.32', 0).then(async () => {

  // add all tags to the group with their tag names
  for (let i = 0; i < tags32.length; i++) {
    const tagName = tags32[i][0];
    PLC.newTag(tagName);
  }

  const data = [];
  for (let i = 0; i < tags32.length; i++) {
    const tagName = tags32[i][0];
    const tagAlias = tags32[i][1];
    const tagValue = await PLC.readTag(tagName);
    const tagType = typeof tagValue;
    data.push({ tagAlias, tagValue, tagName, tagType });
  }
  console.log(data);

}).catch(async e => {
  console.log(e);
});
