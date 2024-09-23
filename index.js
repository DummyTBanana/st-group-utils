import { saveSettingsDebounced, characters, setExtensionPrompt, MAX_INJECTION_DEPTH } from "../../../../script.js";
import { extension_settings, getContext } from "../../../extensions.js";
import { groups } from "../../../group-chats.js";
import { MacrosParser } from '../../../macros.js';
import { getTokenCountAsync } from "../../../tokenizers.js";
import { SlashCommandClosure } from "../../../slash-commands/SlashCommandClosure.js";

// Keep track of where your extension is located, name should match repo name
const extensionName = "st-group-utils";
const EXTENSION_PROMPT_KEY = "ub_grouputils"
const EXTENSION_PROMPT_KEY_CHAR = "ub_grouputils_char"
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const settings = {
  char_position: 0,
  position: 1,
  depth: 4,
  include_wi: false
}

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
    Object.assign(extension_settings[extensionName], settings);
  }
  settings.depth = extension_settings[extensionName].depth
  settings.include_wi = extension_settings[extensionName].include_wi
  $("#share_character_info").prop("checked", extension_settings[extensionName].share_character_info || true).trigger("input");
  $("#include_worldinfo").prop("checked", extension_settings[extensionName].include_wi || true).trigger("input");
  $("#share_stopper").val(extension_settings[extensionName].share_stopper || '.').trigger("input");
  $("#max_share_length").val(extension_settings[extensionName].max_share_length || 200).trigger("input");
  $("#text_depth").val(extension_settings[extensionName].depth || 4).trigger("input");
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


async function rearrangeChat(chat){
  try{
    const context = getContext()
    const group = getGroup(context.groupId)
    const generating_name = context.name2
    if (!group) return;
    if (!extension_settings[extensionName].share_character_info) return;
    let system_notes = []
    let character_description = []
    for (let i = 0; i < group.members.length; i++) {
      const element = group.members[i];
      const character = getCharacterByName(element.split(".png")[0])
      if (character){
        if (character.name != generating_name){
          if (character.description.length > 0 && character.personality.length > 0) {
            getText(character.description).then((desc) => {
              getText(character.personality).then((pers) => {
                console.log(`Adding ${character.name}'s Details`)
                character_description.push(`${desc.replaceAll("{{char}}", character.name)}\n${character.name}'s Personality: ${pers.replaceAll("{{char}}", character.name)}`);
              });
            });
          }
        } 
        if (extension_settings[extensionName]['character_data'] != undefined && extension_settings[extensionName]['character_data'] != null)
        {
          const note = extension_settings[extensionName]['character_data'][character.name];
          if (note != undefined && note != null) {
            console.log(`Adding ${character.name}'s Group Note`)
            system_notes.push(note.toString().replaceAll("{{char}}",character.name));
          }
        }
      }
    }
    console.log(chat)
  }catch(e){
    console.log(e)
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

  // Chat Injection
  $("#include_worldinfo").on("input",function(event){
    const value = $(event.target).val();
    settings.include_wi = Boolean(value)
    extension_settings[extensionName].include_wi = Boolean(value)
    saveSettingsDebounced()
  })
  $("#text_depth").on("input",function(event){
    const value = $(event.target).val();
    settings.depth = parseFloat(value)
    extension_settings[extensionName].depth = parseFloat(value)
    saveSettingsDebounced()
  })

  loadSettings();
});