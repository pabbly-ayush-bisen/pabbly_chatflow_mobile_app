import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { callApi, endpoints, httpMethods } from '../../utils/axios';

// Async thunks
export const getAssistants = createAsyncThunk(
  'assistant/getAssistants',
  async ({ page = 1, limit = 50, fetchAll = true, status, name }, { rejectWithValue }) => {
    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      // Always include fetchAll=true to get actual assistant data
      params.append('fetchAll', 'true');

      if (status && status !== 'all') {
        params.append('status', status);
      }
      if (name) {
        params.append('name', name);
      }

      const url = `${endpoints.assistants.getAssistants}?${params.toString()}`;
      console.log('[getAssistants] Request URL:', url);

      const response = await callApi(url, httpMethods.GET);

      console.log('[getAssistants] Response:', JSON.stringify(response, null, 2));

      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch assistants');
      }
      return response;
    } catch (error) {
      console.error('[getAssistants] Error:', error);
      return rejectWithValue(error.message);
    }
  }
);

export const getAssistant = createAsyncThunk(
  'assistant/getAssistant',
  async (id, { rejectWithValue }) => {
    try {
      const url = `${endpoints.assistants.getAssistant}/${id}`;
      const response = await callApi(url, httpMethods.GET);

      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch assistant');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const getAssistantStats = createAsyncThunk(
  'assistant/getAssistantStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await callApi(endpoints.assistants.getAssistantStats, httpMethods.GET);

      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch assistant stats');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Initial state
const initialState = {
  assistants: [],
  selectedAssistant: null,
  assistantsStatus: 'idle',
  assistantsError: null,
  assistantStatus: 'idle',
  assistantError: null,
  statsStatus: 'idle',
  statsError: null,
  totalAssistants: 0,
  activeAssistants: 0,
  inactiveAssistants: 0,
  totalResults: 0,
};

// Slice
const assistantSlice = createSlice({
  name: 'assistant',
  initialState,
  reducers: {
    setSelectedAssistant: (state, action) => {
      state.selectedAssistant = action.payload;
    },
    clearAssistantError: (state) => {
      state.assistantsError = null;
      state.assistantError = null;
      state.statsError = null;
    },
  },
  extraReducers: (builder) => {
    // Get Assistants
    builder
      .addCase(getAssistants.pending, (state) => {
        state.assistantsStatus = 'loading';
        state.assistantsError = null;
      })
      .addCase(getAssistants.fulfilled, (state, action) => {
        state.assistantsStatus = 'succeeded';
        const payload = action.payload;

        // Debug logging - log the full payload structure
        console.log('[AssistantSlice] ====== FULL PAYLOAD ======');
        console.log('[AssistantSlice] payload keys:', payload ? Object.keys(payload) : 'null');
        console.log('[AssistantSlice] payload.data:', payload?.data);
        console.log('[AssistantSlice] payload.assistants:', payload?.assistants);
        console.log('[AssistantSlice] payload._raw:', payload?._raw);

        // Handle multiple possible response structures
        // The API might return assistants in different locations
        let assistantsList = [];
        const raw = payload?._raw || {};

        // Check all possible locations for the assistants array (priority order)
        if (Array.isArray(payload?.assistants)) {
          // Direct from callApi spreading: { assistants: [...] }
          console.log('[AssistantSlice] Found in payload.assistants');
          assistantsList = payload.assistants;
        } else if (Array.isArray(raw?.assistants)) {
          // From raw response: { _raw: { assistants: [...] } }
          console.log('[AssistantSlice] Found in payload._raw.assistants');
          assistantsList = raw.assistants;
        } else if (Array.isArray(payload?.data?.assistants)) {
          // Nested in data: { data: { assistants: [...] } }
          console.log('[AssistantSlice] Found in payload.data.assistants');
          assistantsList = payload.data.assistants;
        } else if (Array.isArray(raw?.data?.assistants)) {
          // Nested in raw.data: { _raw: { data: { assistants: [...] } } }
          console.log('[AssistantSlice] Found in payload._raw.data.assistants');
          assistantsList = raw.data.assistants;
        } else if (Array.isArray(payload?.data)) {
          // Data is array: { data: [...] }
          console.log('[AssistantSlice] Found in payload.data (array)');
          assistantsList = payload.data;
        } else if (Array.isArray(raw?.data)) {
          // Raw data is array: { _raw: { data: [...] } }
          console.log('[AssistantSlice] Found in payload._raw.data (array)');
          assistantsList = raw.data;
        } else if (Array.isArray(payload)) {
          // Payload is array: [...]
          console.log('[AssistantSlice] Found in payload (array)');
          assistantsList = payload;
        } else {
          console.log('[AssistantSlice] No assistants found in any known location');
        }

        console.log('[AssistantSlice] Final assistants list:', assistantsList.length, 'items');
        if (assistantsList.length > 0) {
          console.log('[AssistantSlice] First assistant:', JSON.stringify(assistantsList[0], null, 2));
        }

        state.assistants = assistantsList;
        state.totalResults = payload?.pagination?.totalItems || raw?.pagination?.totalItems || payload?.data?.pagination?.totalItems || assistantsList.length;
      })
      .addCase(getAssistants.rejected, (state, action) => {
        state.assistantsStatus = 'failed';
        state.assistantsError = action.payload;
      });

    // Get Assistant
    builder
      .addCase(getAssistant.pending, (state) => {
        state.assistantStatus = 'loading';
        state.assistantError = null;
      })
      .addCase(getAssistant.fulfilled, (state, action) => {
        state.assistantStatus = 'succeeded';
        state.selectedAssistant = action.payload.data || action.payload;
      })
      .addCase(getAssistant.rejected, (state, action) => {
        state.assistantStatus = 'failed';
        state.assistantError = action.payload;
      });

    // Get Assistant Stats
    builder
      .addCase(getAssistantStats.pending, (state) => {
        state.statsStatus = 'loading';
        state.statsError = null;
      })
      .addCase(getAssistantStats.fulfilled, (state, action) => {
        state.statsStatus = 'succeeded';
        const data = action.payload.data || action.payload;
        state.totalAssistants = data.total || 0;
        state.activeAssistants = data.active || 0;
        state.inactiveAssistants = data.inactive || 0;
      })
      .addCase(getAssistantStats.rejected, (state, action) => {
        state.statsStatus = 'failed';
        state.statsError = action.payload;
      });
  },
});

export const { setSelectedAssistant, clearAssistantError } = assistantSlice.actions;
export default assistantSlice.reducer;
