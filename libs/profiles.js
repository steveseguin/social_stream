 // Add this to popup.js near the PollManager
const ProfileManager = {
  profiles: [],
  currentProfileId: null,

  init() {
    document.getElementById('profilesList').addEventListener('click', (e) => {
      const target = e.target;
      if (target.classList.contains('delete-profile')) {
        const profileItem = target.closest('.profile-item');
        const profileId = profileItem.dataset.profileId;
        if (confirm('Are you sure you want to delete this profile?')) {
          this.profiles = this.profiles.filter(p => p.id !== profileId);
          if (this.currentProfileId === profileId) {
            this.currentProfileId = null;
          }
          this.updateProfilesList();
          this.saveProfilesToStorage();
        }
      } else if (target.classList.contains('activate-profile')) {
        const profileItem = target.closest('.profile-item');
        const profileId = profileItem.dataset.profileId;
        this.loadProfile(profileId);
      }
    });

    // Load profiles from storage
    chrome.runtime.sendMessage({cmd: "getSettings"}, (response) => {
      if (response && response.settings && response.settings.savedProfiles && response.settings.savedProfiles.json) {
        try {
          this.profiles = JSON.parse(response.settings.savedProfiles.json);
          this.updateProfilesList();
        } catch(e) {
          console.error("Error parsing saved profiles:", e);
        }
      }
    });
  },

  async saveCurrentProfile() {
    const profileName = await prompt("Enter a name for this profile:", "My Profile");
    if (!profileName) return;

    // Get current settings
    const currentSettings = {};
    
    // Gather all settings from checkbox inputs
    document.querySelectorAll('input[type="checkbox"][data-setting]').forEach(input => {
      const settingName = input.dataset.setting;
      currentSettings[settingName] = { setting: input.checked };
    });
    
    // Gather all settings from text inputs
    document.querySelectorAll('input[type="text"][data-textsetting], textarea[data-textsetting]').forEach(input => {
      const settingName = input.dataset.textsetting;
      currentSettings[settingName] = { textsetting: input.value };
    });
    
    // Gather all settings from select inputs
    document.querySelectorAll('select[data-optionsetting]').forEach(select => {
      const settingName = select.dataset.optionsetting;
      currentSettings[settingName] = { optionsetting: select.value };
    });
    
    // Gather all settings from number inputs
    document.querySelectorAll('input[type="number"][data-numbersetting]').forEach(input => {
      const settingName = input.dataset.numbersetting;
      currentSettings[settingName] = { numbersetting: input.value };
    });
    
    // Gather param settings
    for (let i = 1; i <= 18; i++) {
      document.querySelectorAll(`input[data-param${i}]`).forEach(input => {
        const settingName = input.dataset[`param${i}`];
        if (!currentSettings[settingName]) currentSettings[settingName] = {};
        currentSettings[settingName][`param${i}`] = input.checked;
      });
      
      document.querySelectorAll(`input[data-textparam${i}], textarea[data-textparam${i}]`).forEach(input => {
        const settingName = input.dataset[`textparam${i}`];
        if (!currentSettings[settingName]) currentSettings[settingName] = {};
        currentSettings[settingName][`textparam${i}`] = input.value;
      });
      
      document.querySelectorAll(`select[data-optionparam${i}]`).forEach(select => {
        const settingName = select.dataset[`optionparam${i}`];
        if (!currentSettings[settingName]) currentSettings[settingName] = {};
        currentSettings[settingName][`optionparam${i}`] = select.value;
      });
      
      document.querySelectorAll(`input[data-numbersetting${i}]`).forEach(input => {
        const settingName = input.dataset[`numbersetting${i}`];
        if (!currentSettings[settingName]) currentSettings[settingName] = {};
        currentSettings[settingName][`numbersetting${i}`] = input.value;
      });
    }

    const newProfile = {
      id: Date.now().toString(),
      name: profileName,
      dateCreated: new Date().toISOString(),
      settings: currentSettings
    };

    this.profiles.push(newProfile);
    this.currentProfileId = newProfile.id;
    this.updateProfilesList();
    this.saveProfilesToStorage();
    
    alert(`Profile "${profileName}" saved successfully!`);
  },

  loadProfile(profileId) {
    const profile = this.profiles.find(p => p.id === profileId);
    if (!profile) return;

    if (!confirm(`Load profile "${profile.name}"? This will replace all your current settings.`)) {
      return;
    }

    // Apply the settings from the profile
    for (const [key, settingObj] of Object.entries(profile.settings)) {
      try {
        processObjectSetting(key, settingObj, true, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18], {settings: profile.settings});
      } catch (e) {
        console.error(`Error applying setting ${key}:`, e);
      }
    }

    this.currentProfileId = profileId;
    this.updateProfilesList();
    
    // Force a refresh of links and UI elements
    refreshLinks();
    
    // Refresh the UI with the new settings
    chrome.runtime.sendMessage({cmd: "getSettings"}, (response) => {
      update(response, false);
    });
    
    alert(`Profile "${profile.name}" loaded successfully!`);
  },

  updateProfilesList() {
    const container = document.getElementById('profilesList');
    if (!container) return;
    
    container.innerHTML = '';

    this.profiles.sort((a, b) => {
      if (a.id === this.currentProfileId) return -1;
      if (b.id === this.currentProfileId) return 1;
      return b.dateCreated.localeCompare(a.dateCreated);
    }).forEach(profile => {
      const isActive = profile.id === this.currentProfileId;
      
      const profileElement = document.createElement('div');
      profileElement.className = 'profile-item';
      profileElement.dataset.profileId = profile.id;
      profileElement.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px; margin: 8px 0; background: rgba(0,0,0,0.1); border-radius: 4px;';
      
      if (isActive) {
        profileElement.style.background = 'rgba(0,255,0,0.1)';
        profileElement.style.borderLeft = '3px solid #00cc00';
      }

      const profileDate = new Date(profile.dateCreated);
      const dateStr = profileDate.toLocaleDateString();

      profileElement.innerHTML = `
        <div class="profile-info" style="flex-grow: 1;">
          <div class="profile-name" style="font-weight: ${isActive ? 'bold' : 'normal'};">${profile.name}</div>
          <div class="profile-date" style="font-size: 0.8em; opacity: 0.7;">${dateStr}</div>
        </div>
        <div class="profile-actions">
          ${!isActive ? `<button class="activate-profile glowingButton" style="margin-right: 5px;">Load</button>` : ''}
          <button class="delete-profile glowingButton" style="background: #ff4444;">Delete</button>
        </div>
      `;
      container.appendChild(profileElement);
    });
    
    if (this.profiles.length === 0) {
      container.innerHTML = '<div style="text-align: center; padding: 10px; color: #888;">No profiles saved yet</div>';
    }
  },

  saveProfilesToStorage() {
    chrome.runtime.sendMessage({
      cmd: "saveSetting",
      type: "json",
      setting: "savedProfiles",
      value: JSON.stringify(this.profiles)
    });
  }
};

