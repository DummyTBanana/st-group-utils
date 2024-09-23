// The main script for the extension
// The following are examples of some basic extension functionality

//You'll likely need to import extension_settings, getContext, and loadExtensionSettings from extensions.js
import { extension_settings, getContext } from "../../../extensions.js";
import { groups } from "../../../group-chats.js";
import { MacrosParser } from '../../../macros.js';

//You'll likely need to import some other functions from the main script
import { saveSettingsDebounced, characters, setExtensionPrompt, saveCharacterDebounced } from "../../../../script.js";
import { getTokenCountAsync } from "../../../../scripts/tokenizers.js";
import { SlashCommandClosure } from "../../../../scripts/slash-commands/SlashCommandClosure.js";

// Keep track of where your extension is located, name should match repo name
const extensionName = "st-group-utils";
const EXTENSION_PROMPT_KEY = "ub_grouputils"
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const extensionSettings = extension_settings[extensionName];
const defaultSettings = {};

function countTokens(text){
  if (text instanceof SlashCommandClosure || Array.isArray(text)) throw new Error('Unnamed argument cannot be a closure for command /tokens');
  return getTokenCountAsync(text).then(count => String(count));
}

function getCharacterByName(name){
  for (let i = 0; i < characters.length; i++) {
    const element = characters[i];
    if (element.name == name){
      return element
    }
  }
  return null;
}
 
// Loads the extension settings if they exist, otherwise initializes them to the defaults.
async function loadSettings() {
  //Create the settings if they don't exist
  extension_settings[extensionName] = extension_settings[extensionName] || {};
  if (Object.keys(extension_settings[extensionName]).length === 0) {
    Object.assign(extension_settings[extensionName], defaultSettings);
  }
  $("#share_character_info").prop("checked", extension_settings[extensionName].share_character_info || true).trigger("input");
  $("#include_worldinfo").prop("checked", extension_settings[extensionName].include_worldinfo || true).trigger("input");
  $("#share_stopper").val(extension_settings[extensionName].share_stopper || '.').trigger("input");
  $("#max_share_length").val(extension_settings[extensionName].max_share_length || 200).trigger("input");
  $("#text_depth").val(extension_settings[extensionName].text_depth || 4).trigger("input");
  $("#max_characters").val(extension_settings[extensionName].max_characters || -1).trigger("input");
}

function getGroup(groupId){
  const group = groups.find((x) => x.id.toString() === groupId);
  if (!group) {
    return;
  }
  return group
}

function getCharacter(characterPNG)
{
  for (let i = 0; i < characters.length; i++) {
    const element = characters[i];
    if (element.avatar == characterPNG){return element}
  }
  return null
}

async function getText(text=String){
  let stopper = extension_settings[extensionName].share_stopper;
  let maxLength = extension_settings[extensionName].max_share_length;

  // Check if the stopper exists in the text
  if (new RegExp(".+\\" + stopper).test(text)) {
    // Return text up to the stopper
    return text.split(stopper)[0];
  } else {
    // Get the token count of the text
    let tokenCount = await countTokens(text);

    // If the token count exceeds the max length, truncate the text
    if (tokenCount > maxLength) {
      let truncatedText = "";

      // Keep adding words until the token limit is reached
      let words = text.split(" ");
      for (let i = 0; i < words.length; i++) {
        let tempText = truncatedText + (i > 0 ? " " : "") + words[i];
        let currentTokenCount = await countTokens(tempText);
        if (currentTokenCount > maxLength) break;
        truncatedText = tempText;
      }

      return truncatedText;
    }

    // If the token count is within the limit, return the full text
    return text;
  }
}


function rearrangeChat(chat){
  try{
    const context = getContext()
    const group = getGroup(context.groupId)
    if (!group) return;
    if (!extension_settings[extensionName].share_character_info) return;
    let char_list = []
    console.log(context)
    for (let i = 0; i < group.members.length; i++) {
      const element = group.members[i];
      const character = getCharacterByName(element.split(".png")[0])
      if (character){

      }
    }
  }catch(e){
    toastr.error(
      e,
      'An Error Occured!'
    )
  }
}

window['gchar_genIntercept'] = rearrangeChat;

// This function is called when the extension is loaded
jQuery(async () => {
  const target = $('#character_popup-button-h3')[0];
  const observer = new MutationObserver(function(mutationsList, observer) {
    for (let mutation of mutationsList) {
      if (mutation.type === 'childList' || mutation.type === 'characterData') {
        const character_text = $(mutation.target).text();
        const newValue = extension_settings[extensionName]['character_data'][character_text] || "";
        $('#group_note_pole').val(newValue);
      }
    }
  });
  observer.observe(target, { characterData: true, childList: true, subtree: true });

  MacrosParser.registerMacro('char_list',function(){
    const context = getContext()
    const group = getGroup(context.groupId)
    if (!group){return context.name2}
    let characters = []
    for (let i = 0; i < group.members.length; i++) {
      const element = group.members[i];
      const character = getCharacter(element)
      if (character && character.name != context.name2 && character.description.length > 0 && character.personality.length > 0){
        characters.push(character)
      }
    }
    return characters.map(obj => obj.name).join(', ');
  })
  MacrosParser.registerMacro('char_list_all',function(){
    const context = getContext()
    const group = getGroup(context.groupId)
    if (!group){return context.name2}
    let characters = []
    for (let i = 0; i < group.members.length; i++) {
      const element = group.members[i];
      const character = getCharacter(element)
      if (character && character.description.length > 0 && character.personality.length > 0){
        characters.push(character)
      }
    }
    return characters.map(obj => obj.name).join(', ');
  })

  const note_visual_insert_depth = 9
  const group_note_element = await $.get(`${extensionFolderPath}/group_note.html`)
  const container = $('#character_popup');
  if (container.children().length >= note_visual_insert_depth) {
    container.children().eq(note_visual_insert_depth-1).after(group_note_element);
  }

  const settingsHtml = await $.get(`${extensionFolderPath}/example.html`);
  $("#extensions_settings2").append(settingsHtml);
  $("#share_character_info").on("input", function(event){
    const value = Boolean($(event.target).prop("checked"));
    extension_settings[extensionName].share_character_info = value;
    saveSettingsDebounced();
  });
  $("#include_worldinfo").on("input", function(event){
    const value = Boolean($(event.target).prop("checked"));
    extension_settings[extensionName].include_worldinfo = value;
    saveSettingsDebounced();
  });
  $("#share_stopper").on("input", function(event){
    const value = $(event.target).val();
    extension_settings[extensionName].share_stopper = value;
    saveSettingsDebounced();
  });
  $("#max_share_length").on("input", function(event){
    const value = $(event.target).val();
    extension_settings[extensionName].max_share_length = value;
    saveSettingsDebounced();
  });
  $("#text_depth").on("input", function(event){
    const value = $(event.target).val();
    extension_settings[extensionName].text_depth = value;
    saveSettingsDebounced();
  });
  $("#max_characters").on("input", function(event){
    const value = $(event.target).val();
    extension_settings[extensionName].max_characters = value;
    saveSettingsDebounced();
  });
  $("#group_note_pole").on("input",function (event) {
    const value = $(event.target).val();
    const character_text = $("#character_popup-button-h3").text()
    const character = getCharacterByName(character_text);
    if (character == null)
      return;
    if (extension_settings[extensionName]['character_data'] == null || extension_settings[extensionName]['character_data'] == undefined){
      extension_settings[extensionName]['character_data'] = {}
    }
    extension_settings[extensionName]['character_data'][character.name] = value
    saveSettingsDebounced();
  })

  loadSettings();
});