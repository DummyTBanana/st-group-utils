// The main script for the extension
// The following are examples of some basic extension functionality

//You'll likely need to import extension_settings, getContext, and loadExtensionSettings from extensions.js
import { extension_settings, getContext } from "../../../extensions.js";
import { groups } from "../../../group-chats.js";

//You'll likely need to import some other functions from the main script
import { saveSettingsDebounced,characters } from "../../../../script.js";

// Keep track of where your extension is located, name should match repo name
const extensionName = "st-extension-example";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const extensionSettings = extension_settings[extensionName];
const defaultSettings = {};

const phraseTester = /(.+($|\.)){1}/


 
// Loads the extension settings if they exist, otherwise initializes them to the defaults.
async function loadSettings() {
  //Create the settings if they don't exist
  extension_settings[extensionName] = extension_settings[extensionName] || {};
  if (Object.keys(extension_settings[extensionName]).length === 0) {
    Object.assign(extension_settings[extensionName], defaultSettings);
  }
}

function getGroup(groupId){
  const group = groups.find((x) => x.id.toString() === groupId);
  if (!group) {
      console.warn('Group not found', groupId);
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

function rearrangeChat(chat){
  const context = getContext()
  const group = getGroup(context.groupId)
  if (!group) { return; }
  var notes = []
  for (let i = 0; i < group.members.length; i++) {
    const element = group.members[i];
    const character = getCharacter(element)
    if (character && context.name2 != character.name){
      const hasDesc = phraseTester.test(character.description)
      const hasPersonality = phraseTester.test(character.personality)
      if (hasDesc && hasPersonality){
        const desc = phraseTester.exec(character.description)[0].replaceAll("{{char}}",character.name)
        const person = phraseTester.exec(character.personality)[0].replaceAll("{{char}}",character.name)
        notes.push(`[System Note: ${character.name} description is: ${desc} and their personality is: ${person}]`)
      }
    }
  }
  console.log(notes.join("\n"))
}

window['gchar_genIntercept'] = rearrangeChat;

// This function is called when the extension is loaded
jQuery(async () => {
  const settingsHtml = await $.get(`${extensionFolderPath}/example.html`);
  //$("#extensions_settings").append(settingsHtml);

  loadSettings();
});
