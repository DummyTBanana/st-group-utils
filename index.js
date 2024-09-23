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

async function getText(text) {
  const stopper = extension_settings[extensionName].share_stopper;
  const maxLength = extension_settings[extensionName].max_share_length;

  // Step 1: Check if the stopper exists in the text and truncate it if found
  if (text.includes(stopper)) {
    return text.split(stopper)[0];
  }
  if (await countTokens(text) <= maxLength)
  {
    return text
  }
  let words = text.split(" ")
  let tokenCount = 0
  let truncatedWords = []
  for (let i = 0; i < words.length; i++) {
    const element = words[i];
    const tokens = parseFloat(await countTokens(element))
    if ((tokenCount + tokens) <= maxLength){
      tokenCount = tokenCount + tokens
      console.log(`Adding Word ${element}: Token Count = ${tokens}; Total Tokens = ${tokenCount}`)
      truncatedWords.push(element)
    } else{
      break;
    }
  }
  // Step 5: Join the truncated words back into a string
  let truncatedText = truncatedWords.join(" ");

  // Step 6: Find the last occurrence of punctuation (.,;,?)
  let lastPunctuationIndex = Math.max(
    truncatedText.lastIndexOf('.'),
    truncatedText.lastIndexOf(','),
    truncatedText.lastIndexOf(';'),
    truncatedText.lastIndexOf('?')
  );

  // Step 7: If there's punctuation, trim the text to that point and replace the punctuation with a period (.)
  if (lastPunctuationIndex > -1) {
    truncatedText = truncatedText.slice(0, lastPunctuationIndex + 1).replace(/[,;?]$/, '.');
  }

  // Return the final truncated text
  return truncatedText;
}


async function rearrangeChat(chat = [any]) {
  try {
    const context = getContext();
    const group = getGroup(context.groupId);
    const generating_name = context.name2;
    if (!group) return;
    if (!extension_settings[extensionName].share_character_info) return;

    let system_notes = [];
    let character_description = [];

    // Create an array of promises for getting character descriptions and personalities
    const descriptionPromises = group.members.map(async (element) => {
      const character = getCharacterByName(element.split(".png")[0]);
      if (character && character.name != generating_name) {
        if (character.description.length > 0 && character.personality.length > 0) {
          const desc = await getText(character.description);
          const pers = await getText(character.personality);
          console.log(`Adding ${character.name}'s Details`);
          character_description.push(
            `[System Note: ${desc.replaceAll("{{char}}", character.name)}\n${character.name}'s Personality: ${pers.replaceAll("{{char}}", character.name)}]`
          );
        }
      }
      return character;
    });

    // Wait for all description promises to resolve
    await Promise.all(descriptionPromises);

    // Process character notes
    for (const element of group.members) {
      const character = getCharacterByName(element.split(".png")[0]);
      if (character) {
        if (extension_settings[extensionName]['character_data'] != undefined && extension_settings[extensionName]['character_data'] != null) {
          const note = extension_settings[extensionName]['character_data'][character.name];
          if (note != undefined && note != null) {
            console.log(`Adding ${character.name}'s Group Note`);
            system_notes.push(note.toString().replaceAll("{{char}}", character.name));
          }
        }
      }
    }

    let pair = [];
    if (character_description.length > 0) {
      pair.push(character_description.join("\n"));
    }
    if (system_notes.length > 0) {
      pair.push(system_notes.join("\n"));
    }
    if (pair.length > 0) {
      const systemNote = {
        "name": "System",
        "is_user": false,
        "is_system": "",
        "send_date": new Date(Date.now()).toString(),
        "mes": pair.join("\n"),
      };
      chat.splice(settings.depth, 0, systemNote);
      console.log("Chat Modified!", chat);
    } else {
      console.warn("No custom data to import!");
    }
  } catch (e) {
    console.log(e);
    toastr.error(e, 'An Error Occurred!');
  }
}

// This function is called when the extension is loaded
jQuery(async () => {
  window['groupUtils_generationInterceptor'] = rearrangeChat;
  const target = $('#character_popup-button-h3')[0];
  const observer = new MutationObserver(function(mutationsList, observer) {
    for (let mutation of mutationsList) {
      if (mutation.type === 'childList' || mutation.type === 'characterData') {
        const character_text = $(mutation.target).text();
        try{
          const newValue = extension_settings[extensionName]['character_data'][character_text] || "";
          $('#group_note_pole').val(newValue);
        }catch{}
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