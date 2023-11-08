$(document).ready(function () {
    let plcs = []; // Declare the plcs array to store the PLC data
    let unsavedTags = []; // Declare the unsavedTags array to store the unsaved tags
  
    loadTags();
  
    $(".addTag").on("click", function (event) { // Fix here: Use ".addTag" instead of "addTag"
      event.preventDefault();
  
      const plcIndex = $(this).data("plc-index"); // Get the PLC index from the addTag button
  
      const name = $(this).closest("tr").find(".addName").val();
      const alias = $(this).closest("tr").find(".addAlias").val();
      const taggroup = $(this).closest("tr").find(".addTaggroup").val();
      const PublishGroup = $(this).closest("tr").find(".addPublishGroup").val();
      const tagConvertion = $(this).closest("tr").find(".addTagConvertion").val();
  
      const newTag = { name, alias, taggroup, PublishGroup, tagConvertion };
      addTag(newTag, plcIndex); // Pass plcIndex as an argument
    });
  
    $(document).on("click", ".deleteTag", function () {
      const name = $(this).data("name");
      deleteTag(name);
    });
  
    $(document).on("click", ".confirmTags", function () {
      const plcIndex = $(this).data("plc-index");
      const plc = plcs[plcIndex];
      const updatedTags = unsavedTags.filter((tag) => tag.plcIndex === plcIndex).map((tag) => tag.tag);
  
      // Perform API call to update the tags
      updateTags(plcIndex, updatedTags);
    });
  
    function loadTags() {
      // Fetch tags from server and call displayTags()
      // The server endpoint not provided, so this is a pseudo code
      fetch("/api/getjson")
        .then((res) => res.json()) // Add this line to parse the response as JSON
        .then((data) => {
          plcs = data; // Store the fetched PLC data in the plcs array
          console.log(plcs);
          displayTags(plcs);
        })
        .catch((error) => console.error("Error:", error)); // Catch and log any errors
    }
  
    function displayTags(plcs) {
        const container = $("#tagList");
        container.empty(); // Clear the container before adding new tags
      
        plcs.forEach((plc, plcIndex) => {
          const plcTable = $("<table>");
          plcTable.append(`
            <tr>
              <th colspan="6">${plc.plcName}</th>
            </tr>
            <tr>
              <th>Name</th>
              <th>Alias</th>
              <th>Taggroup</th>
              <th>PublishGroup</th>
              <th>TagConvertion</th>
              <th>Action</th>
            </tr>
          `);
      
          plc.tagData.forEach((tag, tagIndex) => {
            const tagRow = $("<tr>").attr("data-plc-index", plcIndex).attr("data-tag-index", tagIndex);
      
            const tagClass = unsavedTags.some((t) => t.plcIndex === plcIndex && t.tagIndex === tagIndex)
              ? "unsavedTag"
              : "";
      
            tagRow.append(`
              <td>${tag.name}</td>
              <td>${tag.alias}</td>
              <td>${tag.taggroup}</td>
              <td>${tag.PublishGroup}</td>
              <td>${tag.tagConvertion}</td>
              <td><button class="deleteTag" data-name="${tag.name}">Delete</button></td>
            `);
            tagRow.addClass(tagClass); // Add the tagClass to the tagRow
            plcTable.append(tagRow);
          });
      
          const plcContainer = $("<div>").addClass("plcContainer");
          plcContainer.append(plcTable);
      
          const plcNameRow = $("<tr>");
          plcNameRow.append(`
            <td colspan="6" class="plcName">${plc.plcName}</td>
          `);
          plcTable.prepend(plcNameRow);
      
          const addTagRow = $("<tr>");
          addTagRow.append(`
            <td><input type="text" class="addName" placeholder="Name"></td>
            <td><input type="text" class="addAlias" placeholder="Alias"></td>
            <td><input type="text" class="addTaggroup" placeholder="Taggroup"></td>
            <td><input type="text" class="addPublishGroup" placeholder="PublishGroup"></td>
            <td><input type="text" class="addTagConvertion" placeholder="TagConvertion"></td>
            <td><button class="addTag" data-plc-index="${plcIndex}">Add Tag</button></td>
          `);
      
          plcTable.append(addTagRow);
          plcContainer.append(plcTable);
      
          const confirmTagsButton = $("<button>").addClass("confirmTags").text("Confirm Tags").data("plc-index", plcIndex);
          plcContainer.append(confirmTagsButton);
      
          container.append(plcContainer);
        });
      
        // Add unsaved tags with a different color
        unsavedTags.forEach((unsavedTag) => {
          const { plcIndex, tagIndex } = unsavedTag;
          const plcTable = container.find(`table[data-plc-index="${plcIndex}"]`);
          const tagRow = plcTable.find(`tr[data-tag-index="${tagIndex}"]`);
          tagRow.addClass("unsavedTag");
        });
      }
      
  
    function addTag(tag, plcIndex) {
      unsavedTags.push({ tag, plcIndex }); // Add the new tag and plcIndex to the unsavedTags array
      displayTags(plcs); // Refresh the displayed tags
    }
  
    function deleteTag(name) {
      // Modify the JSON data directly by removing the tag with the specified name
      for (let plc of plcs) {
        const tagIndex = plc.tagData.findIndex((tag) => tag.name === name);
        if (tagIndex !== -1) {
          plc.tagData.splice(tagIndex, 1);
          break;
        }
      }
  
      // After modifying the JSON, refresh the displayed tags
      displayTags(plcs);
    }
  
    function updateTags(plcIndex, updatedTags) {
      // Simulating an API call with setTimeout
      setTimeout(function () {
        console.log(`Updating tags for PLC index ${plcIndex}:`, updatedTags);
  
        // TODO: Perform the actual API call to update the tags using the updatedTags data
  
        // Remove the saved tags from the unsavedTags array
        unsavedTags = unsavedTags.filter((tag) => !(tag.plcIndex === plcIndex && updatedTags.includes(tag.tag)));
  
        // Refresh the tags after the update
        displayTags(plcs);
      }, 1000);
    }
  });
  