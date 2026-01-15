import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { callApi, endpoints, httpMethods } from '../../utils/axios';

// Async thunks
export const getBroadcasts = createAsyncThunk(
  'broadcast/getBroadcasts',
  async ({ page = 0, limit = 10, sortBy = 'createdAt', order = 'descending', name = '' }, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortBy,
        order,
      });

      if (name.trim()) {
        queryParams.append('name', name);
      }

      const url = `${endpoints.broadcast.getBroadcasts}/?${queryParams.toString()}`;
      const response = await callApi(url, httpMethods.GET);

      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch broadcasts');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const createBroadcast = createAsyncThunk(
  'broadcast/createBroadcast',
  async (data, { rejectWithValue }) => {
    try {
      const response = await callApi(endpoints.broadcast.createBroadcast, httpMethods.POST, data);

      if (response.status !== 'success' && response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to create broadcast');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteBroadcast = createAsyncThunk(
  'broadcast/deleteBroadcast',
  async (data, { rejectWithValue }) => {
    try {
      const response = await callApi(endpoints.broadcast.deleteBroadcast, httpMethods.DELETE, data);

      if (response.status !== 'success' && response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to delete broadcast');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchBroadcastStats = createAsyncThunk(
  'broadcast/fetchBroadcastStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await callApi(endpoints.broadcast.fetchBroadcastStats, httpMethods.GET);

      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch broadcast stats');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const testBroadcast = createAsyncThunk(
  'broadcast/testBroadcast',
  async (data, { rejectWithValue }) => {
    try {
      const response = await callApi(endpoints.broadcast.testBroadcast, httpMethods.POST, data);

      if (response.status !== 'success' && response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to test broadcast');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const resendBroadcast = createAsyncThunk(
  'broadcast/resendBroadcast',
  async (broadcastId, { rejectWithValue }) => {
    try {
      const url = `${endpoints.broadcast.resendBroadcast}/${broadcastId}`;
      const response = await callApi(url, httpMethods.GET);

      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to resend broadcast');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Initial state
const initialState = {
  broadcasts: [],
  broadcastsStatus: 'idle',
  broadcastsError: null,
  createBroadcastStatus: 'idle',
  createBroadcastError: null,
  deleteBroadcastStatus: 'idle',
  deleteBroadcastError: null,
  statsStatus: 'idle',
  statsError: null,
  testBroadcastStatus: 'idle',
  testBroadcastError: null,
  resendBroadcastStatus: 'idle',
  resendBroadcastError: null,
  totalSearchResult: 0,
  totalBroadcast: 0,
  liveBroadcast: 0,
  sentBroadcast: 0,
  scheduledBroadcast: 0,
  failedBroadcast: 0,
  stoppedBroadcast: 0,
  pausedBroadcast: 0,
};

// Slice
const broadcastSlice = createSlice({
  name: 'broadcast',
  initialState,
  reducers: {
    clearBroadcastError: (state) => {
      state.broadcastsError = null;
      state.createBroadcastError = null;
      state.deleteBroadcastError = null;
      state.statsError = null;
      state.testBroadcastError = null;
      state.resendBroadcastError = null;
    },
  },
  extraReducers: (builder) => {
    // Get Broadcasts
    builder
      .addCase(getBroadcasts.pending, (state) => {
        state.broadcastsStatus = 'loading';
        state.broadcastsError = null;
      })
      .addCase(getBroadcasts.fulfilled, (state, action) => {
        state.broadcastsStatus = 'succeeded';
        const data = action.payload.data || action.payload;
        state.broadcasts = data.broadcasts || [];
        state.totalSearchResult = data.totalResults || 0;
      })
      .addCase(getBroadcasts.rejected, (state, action) => {
        state.broadcastsStatus = 'failed';
        state.broadcastsError = action.payload;
      });

    // Create Broadcast
    builder
      .addCase(createBroadcast.pending, (state) => {
        state.createBroadcastStatus = 'loading';
        state.createBroadcastError = null;
      })
      .addCase(createBroadcast.fulfilled, (state) => {
        state.createBroadcastStatus = 'succeeded';
      })
      .addCase(createBroadcast.rejected, (state, action) => {
        state.createBroadcastStatus = 'failed';
        state.createBroadcastError = action.payload;
      });

    // Delete Broadcast
    builder
      .addCase(deleteBroadcast.pending, (state) => {
        state.deleteBroadcastStatus = 'loading';
        state.deleteBroadcastError = null;
      })
      .addCase(deleteBroadcast.fulfilled, (state) => {
        state.deleteBroadcastStatus = 'succeeded';
      })
      .addCase(deleteBroadcast.rejected, (state, action) => {
        state.deleteBroadcastStatus = 'failed';
        state.deleteBroadcastError = action.payload;
      });

    // Fetch Broadcast Stats
    builder
      .addCase(fetchBroadcastStats.pending, (state) => {
        state.statsStatus = 'loading';
        state.statsError = null;
      })
      .addCase(fetchBroadcastStats.fulfilled, (state, action) => {
        state.statsStatus = 'succeeded';
        const data = action.payload.data || action.payload;
        state.totalBroadcast = String(data.total || 0);
        state.liveBroadcast = String(data.live || 0);
        state.sentBroadcast = String(data.sent || 0);
        state.scheduledBroadcast = String(data.scheduled || 0);
        state.failedBroadcast = String(data.failed || 0);
        state.stoppedBroadcast = String(data.stopped || 0);
        state.pausedBroadcast = String(data.paused || 0);
      })
      .addCase(fetchBroadcastStats.rejected, (state, action) => {
        state.statsStatus = 'failed';
        state.statsError = action.payload;
      });

    // Test Broadcast
    builder
      .addCase(testBroadcast.pending, (state) => {
        state.testBroadcastStatus = 'loading';
        state.testBroadcastError = null;
      })
      .addCase(testBroadcast.fulfilled, (state) => {
        state.testBroadcastStatus = 'succeeded';
      })
      .addCase(testBroadcast.rejected, (state, action) => {
        state.testBroadcastStatus = 'failed';
        state.testBroadcastError = action.payload;
      });

    // Resend Broadcast
    builder
      .addCase(resendBroadcast.pending, (state) => {
        state.resendBroadcastStatus = 'loading';
        state.resendBroadcastError = null;
      })
      .addCase(resendBroadcast.fulfilled, (state) => {
        state.resendBroadcastStatus = 'succeeded';
      })
      .addCase(resendBroadcast.rejected, (state, action) => {
        state.resendBroadcastStatus = 'failed';
        state.resendBroadcastError = action.payload;
      });
  },
});

export const { clearBroadcastError } = broadcastSlice.actions;
export default broadcastSlice.reducer;
