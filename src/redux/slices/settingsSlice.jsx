import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { callApi, endpoints, httpMethods } from '../../utils/axios';

// Async thunks
export const getSettings = createAsyncThunk(
  'settings/getSettings',
  async (keys, { rejectWithValue }) => {
    try {
      const url = `${endpoints.settings.getSettings}?keys=${keys}`;
      const response = await callApi(url, httpMethods.GET);

      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch settings');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateSettings = createAsyncThunk(
  'settings/updateSettings',
  async (bodyData, { rejectWithValue }) => {
    try {
      const { settingId, ...rest } = bodyData;
      const url = endpoints.settings.updateSettings + (settingId ? `/${settingId}` : '');
      const response = await callApi(url, httpMethods.PUT, rest);

      if (response.status !== 'success' && response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to update settings');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteSettings = createAsyncThunk(
  'settings/deleteSettings',
  async ({ settingId, key, names }, { rejectWithValue }) => {
    try {
      // Support key/names deletion (for keywords)
      if (key && names) {
        const url = endpoints.settings.deleteSettings;
        const response = await callApi(url, httpMethods.DELETE, { key, names });

        if (response.status !== 'success' && response.status === 'error') {
          return rejectWithValue(response.message || 'Failed to delete settings');
        }
        return { key, names, ...(response.data || response) };
      }

      // Original settingId-based deletion
      const url = `${endpoints.settings.deleteSettings}/${settingId}`;
      const response = await callApi(url, httpMethods.DELETE);

      if (response.status !== 'success' && response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to delete settings');
      }
      return { settingId, ...(response.data || response) };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const getWebhooks = createAsyncThunk(
  'settings/getWebhooks',
  async (queries, { rejectWithValue }) => {
    try {
      const url = `${endpoints.settings.getWebhooks}?${queries}`;
      const response = await callApi(url, httpMethods.GET);

      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch webhooks');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const testWebhook = createAsyncThunk(
  'settings/testWebhook',
  async ({ _id }, { rejectWithValue }) => {
    try {
      const url = `${endpoints.settings.testWebhook}/${_id}`;
      const response = await callApi(url, httpMethods.POST);

      if (response.status !== 'success' && response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to test webhook');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const getActivityLogs = createAsyncThunk(
  'settings/getActivityLogs',
  async ({ queries }, { rejectWithValue }) => {
    try {
      const url = `${endpoints.settings.getActivityLogs}?${queries}`;
      const response = await callApi(url, httpMethods.GET);

      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch activity logs');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const generateApiToken = createAsyncThunk(
  'settings/generateApiToken',
  async (_, { rejectWithValue }) => {
    try {
      const response = await callApi(endpoints.settings.generateApiToken, httpMethods.POST);

      if (response.status !== 'success' && response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to generate API token');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Initial state
const initialState = {
  getSettingsStatus: 'idle',
  getSettingsError: null,
  updateSettingsStatus: 'idle',
  updateSettingsError: null,
  deleteSettingsStatus: 'idle',
  deleteSettingsError: null,
  webhooksStatus: 'idle',
  webhooksError: null,
  testWebhookStatus: 'idle',
  testWebhookError: null,
  activityLogsStatus: 'idle',
  activityLogsError: null,
  generateApiTokenStatus: 'idle',
  generateApiTokenError: null,
  settings: {
    optInManagement: {
      apiCampaignOptOut: false,
      optInSettings: {
        keywords: [],
        response: {
          enabled: false,
          messageType: '',
          templateName: '',
          headerFileURL: '',
          bodyParams: {},
          headerParams: {},
          regularMessage: '',
          regularMessageType: '',
          fileName: ''
        }
      },
      optOutSettings: {
        keywords: [],
        response: {
          enabled: false,
          messageType: '',
          templateName: '',
          headerFileURL: '',
          bodyParams: {},
          headerParams: {},
          regularMessage: '',
          regularMessageType: '',
          fileName: ''
        }
      }
    },
    inboxSettings: {
      autoResolveChats: false,
      welcomeMessage: {
        enabled: false,
        messageType: '',
        templateName: '',
        headerFileURL: '',
        bodyParams: {},
        headerParams: {},
        regularMessage: '',
        regularMessageType: '',
        fileName: ''
      },
      offHourMessage: {
        enabled: false,
        messageType: '',
        templateName: '',
        headerFileURL: '',
        bodyParams: {},
        headerParams: {},
        regularMessage: '',
        regularMessageType: '',
        fileName: ''
      },
      workingHours: {
        days: {}
      },
      aiAutoReply: {
        isActive: false,
        priorityList: [{}]
      }
    },
    userAttributes: {
      totalCount: 0,
      items: []
    },
    tags: {
      totalCount: 0,
      items: []
    },
    quickReplies: {
      totalCount: 0,
      items: []
    },
    apiWebhook: {
      apiToken: '',
      webhooks: [],
      totalWebhooksCount: 0,
      totalActiveWebhookCount: 0,
      totalInActiveWebhookCount: 0,
      currentFilterWebhookCount: 0
    },
    activityLogs: {
      totalCount: 0,
      items: []
    },
    soundNotification: false,
    timeZone: ''
  },
};

// Slice
const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    clearSettingsError: (state) => {
      state.getSettingsError = null;
      state.updateSettingsError = null;
      state.deleteSettingsError = null;
      state.webhooksError = null;
      state.testWebhookError = null;
      state.activityLogsError = null;
      state.generateApiTokenError = null;
    },
  },
  extraReducers: (builder) => {
    // Get Settings
    builder
      .addCase(getSettings.pending, (state) => {
        state.getSettingsStatus = 'loading';
        state.getSettingsError = null;
      })
      .addCase(getSettings.fulfilled, (state, action) => {
        state.getSettingsStatus = 'succeeded';
        const data = action.payload.data || action.payload;
        state.settings = {
          ...state.settings,
          ...data
        };
      })
      .addCase(getSettings.rejected, (state, action) => {
        state.getSettingsStatus = 'failed';
        state.getSettingsError = action.payload;
      });

    // Update Settings
    builder
      .addCase(updateSettings.pending, (state) => {
        state.updateSettingsStatus = 'loading';
        state.updateSettingsError = null;
      })
      .addCase(updateSettings.fulfilled, (state, action) => {
        state.updateSettingsStatus = 'succeeded';
        const data = action.payload.data || action.payload;
        const { key, data: settingData } = data;
        if (key && settingData !== undefined) {
          const keys = key.split('.');
          let current = state.settings;
          for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
              current[keys[i]] = {};
            }
            current = current[keys[i]];
          }
          current[keys[keys.length - 1]] = settingData;
        }
      })
      .addCase(updateSettings.rejected, (state, action) => {
        state.updateSettingsStatus = 'failed';
        state.updateSettingsError = action.payload;
      });

    // Delete Settings
    builder
      .addCase(deleteSettings.pending, (state) => {
        state.deleteSettingsStatus = 'loading';
        state.deleteSettingsError = null;
      })
      .addCase(deleteSettings.fulfilled, (state, action) => {
        state.deleteSettingsStatus = 'succeeded';
        // The API will refresh the data, so we can trigger a getSettings call
      })
      .addCase(deleteSettings.rejected, (state, action) => {
        state.deleteSettingsStatus = 'failed';
        state.deleteSettingsError = action.payload;
      });

    // Get Webhooks
    builder
      .addCase(getWebhooks.pending, (state) => {
        state.webhooksStatus = 'loading';
        state.webhooksError = null;
      })
      .addCase(getWebhooks.fulfilled, (state, action) => {
        state.webhooksStatus = 'succeeded';
        const data = action.payload.data || action.payload;
        state.settings.apiWebhook.apiToken = data.apiToken || '';
        state.settings.apiWebhook.webhooks = data.webhooks || [];
        state.settings.apiWebhook.totalWebhooksCount = data.totalWebhooks || 0;
        state.settings.apiWebhook.totalActiveWebhookCount = data.activeCount || 0;
        state.settings.apiWebhook.totalInActiveWebhookCount = data.inactiveCount || 0;
        state.settings.apiWebhook.currentFilterWebhookCount = data.currentFilterCount || 0;
      })
      .addCase(getWebhooks.rejected, (state, action) => {
        state.webhooksStatus = 'failed';
        state.webhooksError = action.payload;
      });

    // Test Webhook
    builder
      .addCase(testWebhook.pending, (state) => {
        state.testWebhookStatus = 'loading';
        state.testWebhookError = null;
      })
      .addCase(testWebhook.fulfilled, (state) => {
        state.testWebhookStatus = 'succeeded';
      })
      .addCase(testWebhook.rejected, (state, action) => {
        state.testWebhookStatus = 'failed';
        state.testWebhookError = action.payload;
      });

    // Get Activity Logs
    builder
      .addCase(getActivityLogs.pending, (state) => {
        state.activityLogsStatus = 'loading';
        state.activityLogsError = null;
      })
      .addCase(getActivityLogs.fulfilled, (state, action) => {
        state.activityLogsStatus = 'succeeded';
        const data = action.payload.data || action.payload;
        state.settings.activityLogs.items = data.items || [];
        state.settings.activityLogs.totalCount = data.totalCount || 0;
      })
      .addCase(getActivityLogs.rejected, (state, action) => {
        state.activityLogsStatus = 'failed';
        state.activityLogsError = action.payload;
      });

    // Generate API Token
    builder
      .addCase(generateApiToken.pending, (state) => {
        state.generateApiTokenStatus = 'loading';
        state.generateApiTokenError = null;
      })
      .addCase(generateApiToken.fulfilled, (state, action) => {
        state.generateApiTokenStatus = 'succeeded';
        const data = action.payload.data || action.payload;
        state.settings.apiWebhook.apiToken = data.apiToken || '';
      })
      .addCase(generateApiToken.rejected, (state, action) => {
        state.generateApiTokenStatus = 'failed';
        state.generateApiTokenError = action.payload;
      });
  },
});

export const { clearSettingsError } = settingsSlice.actions;
export default settingsSlice.reducer;
