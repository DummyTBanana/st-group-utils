// The main script for the extension
// The following are examples of some basic extension functionality

//You'll likely need to import extension_settings, getContext, and loadExtensionSettings from extensions.js
import { extension_settings, getContext } from "../../../extensions.js";
import { groups } from "../../../group-chats.js";
import { MacrosParser } from '../../../macros.js';

//You'll likely need to import some other functions from the main script
import { saveSettingsDebounced,characters, setExtensionPrompt,MAX_INJECTION_DEPTH } from "../../../../script.js";

// Keep track of where your extension is located, name should match repo name
const extensionName = "st-extension-group-character-note";
const EXTENSION_PROMPT_KEY = "ub_grouputils"
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const extensionSettings = extension_settings[extensionName];
const defaultSettings = {};



function getPhraseTester(){
  return new RegExp(`.{0,${extension_settings[extensionName].max_share_length}}?(?=(\\${extension_settings[extensionName].share_stopper}|$))`);
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

function getText(text){
  const phraseTester = getPhraseTester()
  let t = phraseTester.exec(text)[0]
  if (t[t.length-1] == ".")
  {return t}
  else if (t[t.length-1] == ",")
  {return t.replace(/(,$)/, '.');}
  else{return t+"."}
}

function CreateSystemNote(text) {
  return {
    "name": "System",
    "is_user": false,
    "is_system": true, 
    "send_date": new Date().toISOString(),
    "mes": text,
    "index": chat.length
  };
}

function rearrangeChat(chat){
  try{
    const context = getContext()
    const group = getGroup(context.groupId)
    let char_list = []
    for (let i = 0; i < group.members.length; i++) {
      const element = group.members[i];
      const character = getCharacter(element)
      if (character){
        char_list.push(character)
      }
    }
    if (extension_settings[extensionName].share_character_info) {
      if (group){
        var notes = []
        let maxCharacters = Math.min(char_list.length,extension_settings[extensionName].max_characters == -1 && char_list.length || extension_settings[extensionName].max_characters)
        for (let i = 0; i < maxCharacters; i++) {
          const character = char_list[i];
          if (character && context.name2 != character.name){
            if (character.description.length > 0 && character.personality.length > 0){
              const desc = getText(character.description).replaceAll("{{char}}",character.name)
              const person = getText(character.personality).replaceAll("{{char}}",character.name)
              notes.push(`[System Note: ${character.name} description is: ${desc} and their personality is: ${person}]`)
            }
          }
        }
        const systemNote = CreateSystemNote(notes.join("\n"))
        setExtensionPrompt(EXTENSION_PROMPT_KEY,systemNote,1,extension_settings[extensionName].text_depth,extension_settings[extensionName].include_worldinfo)
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
  MacrosParser.registerMacro('character_list',function(){
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
  MacrosParser.registerMacro('character_list_all',function(){
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

  loadSettings();
});
