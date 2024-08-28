// The main script for the extension
// The following are examples of some basic extension functionality

//You'll likely need to import extension_settings, getContext, and loadExtensionSettings from extensions.js
import { extension_settings, getContext } from "../../../extensions.js";
import { groups } from "../../../group-chats.js";

//You'll likely need to import some other functions from the main script
import { saveSettingsDebounced,characters } from "../../../../script.js";

// Keep track of where your extension is located, name should match repo name
const extensionName = "st-extension-group-character-note";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const extensionSettings = extension_settings[extensionName];
const defaultSettings = {};

const phraseTester = /.{0,200}\./


 
// Loads the extension settings if they exist, otherwise initializes them to the defaults.
async function loadSettings() {
  //Create the settings if they don't exist
  extension_settings[extensionName] = extension_settings[extensionName] || {};
  if (Object.keys(extension_settings[extensionName]).length === 0) {
    Object.assign(extension_settings[extensionName], defaultSettings);
  }
  $("#share_character_info").prop("checked", extension_settings[extensionName].share_character_info).trigger("input");
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
  const context = getContext()
  const group = getGroup(context.groupId)
  let characters = []
  for (let i = 0; i < group.members.length; i++) {
    const element = group.members[i];
    const character = getCharacter(element)
    if (character){
      characters.push(character)
    }
  }
  if (extension_settings[extensionName].share_character_info) {
    if (!group) { return; }
    var notes = []
    for (let i = 0; i < characters.length; i++) {
      const character = characters[i];
      if (character && context.name2 == character.name){
        const hasDesc = phraseTester.test(character.description)
        const hasPersonality = phraseTester.test(character.personality)
        if (hasDesc && hasPersonality){
          const desc = getText(character.description).replaceAll("{{char}}",character.name)
          const person = getText(character.personality).replaceAll("{{char}}",character.name)
          notes.push(`[System Note: ${character.name} description is: ${desc} and their personality is: ${person}]`)
        }
      }
    }

    const systemNote = CreateSystemNote(notes.join("\n"))
    chat.push(systemNote);
  }
  let newChat = []
  for (let i = 0; i < chat.length; i++) {
    let message = chat[i];
    const content = message.mes
    let r = content.replaceAll("{{character_list}}",characters.filter(x=>x.name != context.name2).map(obj => obj.name).join(', '))
    r = r.replaceAll("{{character_list_all}}",characters.filter(x=>x.name != context.name2).map(obj => obj.name).join(', '))
    message.mes=r
    newChat.push(message)
  }
  chat = newChat
}

window['gchar_genIntercept'] = rearrangeChat;

// This function is called when the extension is loaded
jQuery(async () => {
  const settingsHtml = await $.get(`${extensionFolderPath}/example.html`);
  $("#extensions_settings2").append(settingsHtml);
  $("#share_character_info").on("input", function(event){
    const value = Boolean($(event.target).prop("checked"));
    extension_settings[extensionName].share_character_info = value;
    saveSettingsDebounced();
  });

  loadSettings();
});
