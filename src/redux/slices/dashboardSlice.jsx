import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { callApi, endpoints, httpMethods } from '../../utils/axios';

// Async thunks
export const getDashboardStats = createAsyncThunk(
  'dashboard/getDashboardStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await callApi(endpoints.dashboard.getDashboardStats, httpMethods.GET);
      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch stats');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const getWANumbers = createAsyncThunk(
  'dashboard/getWANumbers',
  async (data, { rejectWithValue }) => {
    try {
      const {
        skip,
        limit,
        status,
        waNumber,
        order = -1,
        fetchAll,
        folderId
      } = data;

      let url = `${endpoints.dashboard.getWANumber}?order=${encodeURIComponent(order)}`;

      if (limit) {
        url += `&limit=${encodeURIComponent(limit)}`;
      }

      if (skip) {
        url += `&skip=${encodeURIComponent(skip)}`;
      }

      if (fetchAll) {
        url += `&fetchAll=${encodeURIComponent(fetchAll)}`;
      }

      if (status && status !== 'all') {
        url += `&status=${encodeURIComponent(status)}`;
      }
      if (waNumber !== undefined && waNumber.trim().length > 0) {
        url += `&waNumber=${encodeURIComponent(waNumber)}`;
      }

      if (folderId !== null && folderId !== undefined) {
        url += `&folderId=${encodeURIComponent(folderId)}`;
      }

      const response = await callApi(url, httpMethods.GET);
      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch WA numbers');
      }
      return { data: response.data, fetchAll };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const getFolders = createAsyncThunk(
  'dashboard/getFolders',
  async ({ sort = -1 }, { rejectWithValue }) => {
    try {
      const url = `${endpoints.dashboard.getFolders}?sort=${sort}`;
      const response = await callApi(url, httpMethods.GET);
      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch folders');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const createFolder = createAsyncThunk(
  'dashboard/createFolder',
  async (data, { rejectWithValue }) => {
    try {
      const response = await callApi(endpoints.dashboard.createFolder, httpMethods.POST, data);
      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to create folder');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteFolder = createAsyncThunk(
  'dashboard/deleteFolder',
  async ({ _id, bodyData }, { rejectWithValue }) => {
    try {
      const url = `${endpoints.dashboard.deleteFolder}/${_id}`;
      const response = await callApi(url, httpMethods.DELETE, bodyData);
      if (response.status !== 'success' && response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to delete folder');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const renameFolder = createAsyncThunk(
  'dashboard/renameFolder',
  async (data, { rejectWithValue }) => {
    try {
      const { id, bodyData } = data;
      const url = `${endpoints.dashboard.renameFolder}/${id}`;
      const response = await callApi(url, httpMethods.PUT, bodyData);
      if (response.status !== 'success' && response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to rename folder');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const moveItemsToAnotherFolder = createAsyncThunk(
  'dashboard/moveItemsToAnotherFolder',
  async (data, { rejectWithValue }) => {
    try {
      const { id, bodyData } = data;
      const url = `${endpoints.dashboard.moveItems}/${id}`;
      const response = await callApi(url, httpMethods.PUT, bodyData);
      if (response.status !== 'success' && response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to move items');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const syncWhatsAppBusinessInfo = createAsyncThunk(
  'dashboard/syncWhatsAppBusinessInfo',
  async (id, { rejectWithValue }) => {
    try {
      const url = `${endpoints.dashboard.syncWhatsAppBusinessInfo}/${id}`;
      const response = await callApi(url, httpMethods.PUT);
      if (response.status !== 'success' && response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to sync');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Initial state
const initialState = {
  statsStatus: 'idle',
  statsError: null,
  accountStatus: 'idle',
  accountError: null,
  folderStatus: 'idle',
  folderError: null,
  whatsappNumbers: [],
  allWhatsappNumbers: [],
  allWhatsappNumbersStatus: 'idle',
  allWhatsappNumbersError: null,
  WANumberCount: 0,
  totalQuota: 0,
  quotaUsed: 0,
  currentFilterCount: 0,
  activeCount: 0,
  inactiveCount: 0,
  folders: {},
  foldersCount: 0,
  shouldFetchFolders: false,
  allNumberCountInCurrentFolder: 0,
  selectedFolder: null,
};

// Slice
const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setShouldFetchFolders: (state, action) => {
      state.shouldFetchFolders = action.payload;
    },
    setFolderFilter: (state, action) => {
      state.selectedFolder = action.payload;
    },
    clearDashboardError: (state) => {
      state.statsError = null;
      state.accountError = null;
      state.folderError = null;
    },
  },
  extraReducers: (builder) => {
    // Get Dashboard Stats
    builder
      .addCase(getDashboardStats.pending, (state) => {
        state.statsStatus = 'loading';
        state.statsError = null;
      })
      .addCase(getDashboardStats.fulfilled, (state, action) => {
        state.statsStatus = 'succeeded';
        // Data is in action.payload.data (from response.data)
        const data = action.payload.data || action.payload;
        state.WANumberCount = data.WANumberCount || 0;
        state.totalQuota = data.totalQuota || 0;
        state.quotaUsed = data.quotaUsed || 0;
      })
      .addCase(getDashboardStats.rejected, (state, action) => {
        state.statsStatus = 'failed';
        state.statsError = action.payload;
      });

    // Get WA Numbers
    builder
      .addCase(getWANumbers.pending, (state, action) => {
        if (action.meta.arg.fetchAll) {
          state.allWhatsappNumbersStatus = 'loading';
        } else {
          state.accountStatus = 'loading';
        }
      })
      .addCase(getWANumbers.fulfilled, (state, action) => {
        // Data structure: { data: { waNumbers, currentFilterCount, ... }, fetchAll }
        const data = action.payload.data || {};
        if (action.meta.arg.fetchAll) {
          state.allWhatsappNumbersStatus = 'succeeded';
          state.allWhatsappNumbers = data.waNumbers || [];
        } else {
          state.accountStatus = 'succeeded';
          state.whatsappNumbers = data.waNumbers || [];
          state.currentFilterCount = data.currentFilterCount || 0;
          state.activeCount = data.activeCount || 0;
          state.inactiveCount = data.inactiveCount || 0;
          state.allNumberCountInCurrentFolder = data.allNumberCountInCurrentFolder || 0;
        }
      })
      .addCase(getWANumbers.rejected, (state, action) => {
        if (action.meta.arg.fetchAll) {
          state.allWhatsappNumbersStatus = 'failed';
          state.allWhatsappNumbersError = action.payload;
        } else {
          state.accountStatus = 'failed';
          state.accountError = action.payload;
        }
      });

    // Get Folders
    builder
      .addCase(getFolders.pending, (state) => {
        state.folderStatus = 'loading';
        state.folderError = null;
      })
      .addCase(getFolders.fulfilled, (state, action) => {
        state.folderStatus = 'succeeded';
        // Data is in action.payload.data
        const data = action.payload.data || action.payload;

        // Debug: Log the raw folder data from API
        console.log('[Redux getFolders] Raw payload:', JSON.stringify(action.payload, null, 2));
        console.log('[Redux getFolders] Extracted data:', JSON.stringify(data, null, 2));

        state.folders = data.folders || {};
        state.foldersCount = data.totalCount || 0;
      })
      .addCase(getFolders.rejected, (state, action) => {
        state.folderStatus = 'failed';
        state.folderError = action.payload;
      });

    // Create Folder
    builder
      .addCase(createFolder.fulfilled, (state) => {
        state.shouldFetchFolders = true;
      });

    // Delete Folder
    builder
      .addCase(deleteFolder.fulfilled, (state) => {
        state.shouldFetchFolders = true;
      });

    // Rename Folder
    builder
      .addCase(renameFolder.fulfilled, (state) => {
        state.shouldFetchFolders = true;
      });

    // Move Items
    builder
      .addCase(moveItemsToAnotherFolder.fulfilled, (state) => {
        state.shouldFetchFolders = true;
      });

    // Sync WhatsApp Business Info
    builder
      .addCase(syncWhatsAppBusinessInfo.fulfilled, (state, action) => {
        // Data is in action.payload.data
        const data = action.payload.data || action.payload;
        const updatedId = data._id;
        const updatedWANumber = state.whatsappNumbers.find(
          number => number._id === updatedId
        );
        if (updatedWANumber) {
          updatedWANumber.account.waPhoneNumberInfo = data.waPhoneNumberInfo;
          updatedWANumber.account.waBusinessProfile = data.waBusinessProfile;
          updatedWANumber.account.waBusinessInfoSyncedAt = data.waBusinessInfoSyncedAt;
        }
      });
  },
});

export const { setShouldFetchFolders, setFolderFilter, clearDashboardError } = dashboardSlice.actions;
export default dashboardSlice.reducer;
