import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { callApi, endpoints, httpMethods } from '../../utils/axios';
import { fetchTemplatesWithCache, fetchTemplateStatsWithCache } from '../cacheThunks';

// Async thunks
export const fetchAllTemplates = createAsyncThunk(
  'template/fetchAllTemplates',
  async ({ page = 0, limit = 10, sortBy = 'createdAt', search, all, type, status, health }, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams({
        ...(all && all !== 'undefined' && all !== ''
          ? { all: String(all) }
          : { page: String(page), limit: String(limit) }),
        sortBy,
      });

      if (search?.trim()) {
        queryParams.append('search', search);
      }
      if (type?.trim() && type !== '') {
        queryParams.append('type', type.toLowerCase());
      }
      if (health?.trim() && health !== '') {
        queryParams.append('health', health);
      }
      if (status?.trim() && status !== '') {
        queryParams.append('status', status);
      }

      const url = `${endpoints.template.fetchAllTemplates}/?${queryParams.toString()}`;
      const response = await callApi(url, httpMethods.GET);

      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch templates');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchTemplateById = createAsyncThunk(
  'template/fetchTemplateById',
  async ({ id, searchType = '' }, { rejectWithValue }) => {
    try {
      const url = `${endpoints.template.fetchTemplateById}/${id}?searchType=${searchType}`;
      const response = await callApi(url, httpMethods.GET);

      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch template');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchTemplateStats = createAsyncThunk(
  'template/fetchTemplateStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await callApi(endpoints.template.fetchTemplateStats, httpMethods.GET);

      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch template stats');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Initial state
const initialState = {
  templates: [],
  selectedTemplate: null,
  templatesStatus: 'idle',
  templateByIdStatus: 'idle',
  statsStatus: 'idle',
  templatesError: null,
  templateByIdError: null,
  statsError: null,
  approvedTemplates: 0,
  pendingTemplates: 0,
  draftTemplates: 0,
  rejectedTemplates: 0,
  totalTemplates: 0,
  totalSearchResult: 0,
  hasMoreTemplates: true,
  currentTemplatesRequestId: null,
};

// Slice
const templateSlice = createSlice({
  name: 'template',
  initialState,
  reducers: {
    setSelectedTemplate: (state, action) => {
      state.selectedTemplate = action.payload;
    },
    clearTemplateError: (state) => {
      state.templatesError = null;
      state.templateByIdError = null;
      state.statsError = null;
    },
    resetTemplates: (state) => {
      state.templates = [];
      state.hasMoreTemplates = true;
    },
    // Silent update from background refresh — updates data without loading states
    silentUpdateTemplates: (state, action) => {
      const { templates, totalCount } = action.payload;
      state.templates = templates;
      if (typeof totalCount === 'number') {
        state.totalSearchResult = totalCount;
      }
    },
    silentUpdateTemplateStats: (state, action) => {
      const data = action.payload;
      state.totalTemplates = String(data.total || 0);
      state.approvedTemplates = String(data.approved || 0);
      state.pendingTemplates = String(data.pending || 0);
      state.draftTemplates = String(data.draft || 0);
      state.rejectedTemplates = String(data.rejected || 0);
    },
    // Update template status from socket event (for real-time template approval updates)
    setUpdatedTemplate: (state, action) => {
      const updatedTemplate = action.payload;
      if (!updatedTemplate?._id) return;

      state.templates = state.templates.map((template) =>
        template._id === updatedTemplate._id
          ? { ...template, ...updatedTemplate }
          : template
      );

      // Also update selected template if it matches
      if (state.selectedTemplate?._id === updatedTemplate._id) {
        state.selectedTemplate = { ...state.selectedTemplate, ...updatedTemplate };
      }
    },
  },
  extraReducers: (builder) => {
    // Fetch All Templates
    builder
      .addCase(fetchAllTemplates.pending, (state) => {
        state.templatesStatus = 'loading';
        state.templatesError = null;
      })
      .addCase(fetchAllTemplates.fulfilled, (state, action) => {
        state.templatesStatus = 'succeeded';
        const data = action.payload.data || action.payload;
        const newTemplates = data.templates || [];
        const append = action.meta.arg.append || false;
        const limit = action.meta.arg.limit || 10;

        if (append) {
          state.templates = [...state.templates, ...newTemplates];
        } else {
          state.templates = newTemplates;
        }
        state.totalSearchResult = data.totalResults || 0;
        state.hasMoreTemplates = newTemplates.length === limit;
      })
      .addCase(fetchAllTemplates.rejected, (state, action) => {
        state.templatesStatus = 'failed';
        state.templatesError = action.payload;
      });

    // Fetch Template By ID
    builder
      .addCase(fetchTemplateById.pending, (state) => {
        state.templateByIdStatus = 'loading';
        state.templateByIdError = null;
      })
      .addCase(fetchTemplateById.fulfilled, (state, action) => {
        state.templateByIdStatus = 'succeeded';
        state.selectedTemplate = action.payload.data || action.payload;
      })
      .addCase(fetchTemplateById.rejected, (state, action) => {
        state.templateByIdStatus = 'failed';
        state.templateByIdError = action.payload;
      });

    // Fetch Template Stats
    builder
      .addCase(fetchTemplateStats.pending, (state) => {
        state.statsStatus = 'loading';
        state.statsError = null;
      })
      .addCase(fetchTemplateStats.fulfilled, (state, action) => {
        state.statsStatus = 'succeeded';
        const data = action.payload.data || action.payload;
        state.totalTemplates = String(data.total || 0);
        state.pendingTemplates = String(data.pending || 0);
        state.approvedTemplates = String(data.approved || 0);
        state.draftTemplates = String(data.draft || 0);
        state.rejectedTemplates = String(data.rejected || 0);
      })
      .addCase(fetchTemplateStats.rejected, (state, action) => {
        state.statsStatus = 'failed';
        state.statsError = action.payload;
      });

    // Fetch Templates with Cache
    builder
      .addCase(fetchTemplatesWithCache.pending, (state, action) => {
        state.templatesStatus = 'loading';
        state.templatesError = null;
        state.currentTemplatesRequestId = action.meta.requestId;
      })
      .addCase(fetchTemplatesWithCache.fulfilled, (state, action) => {
        if (state.currentTemplatesRequestId !== action.meta.requestId) return;
        state.templatesStatus = 'succeeded';
        const { templates, totalCount, skip } = action.payload;
        const limit = action.meta.arg?.limit || 10;

        if (skip > 0) {
          // Load more — append to existing list
          state.templates = [...state.templates, ...templates];
        } else {
          // Initial load or refresh — replace
          state.templates = templates;
        }

        state.totalSearchResult = totalCount;
        state.hasMoreTemplates = templates.length === limit;
      })
      .addCase(fetchTemplatesWithCache.rejected, (state, action) => {
        if (state.currentTemplatesRequestId !== action.meta.requestId) return;
        state.templatesStatus = 'failed';
        state.templatesError = action.payload;
      });

    // Fetch Template Stats with Cache
    builder
      .addCase(fetchTemplateStatsWithCache.pending, (state) => {
        state.statsStatus = 'loading';
        state.statsError = null;
      })
      .addCase(fetchTemplateStatsWithCache.fulfilled, (state, action) => {
        state.statsStatus = 'succeeded';
        const data = action.payload.data || action.payload;
        state.totalTemplates = String(data.total || 0);
        state.approvedTemplates = String(data.approved || 0);
        state.pendingTemplates = String(data.pending || 0);
        state.draftTemplates = String(data.draft || 0);
        state.rejectedTemplates = String(data.rejected || 0);
      })
      .addCase(fetchTemplateStatsWithCache.rejected, (state, action) => {
        state.statsStatus = 'failed';
        state.statsError = action.payload;
      });
  },
});

export const { setSelectedTemplate, clearTemplateError, setUpdatedTemplate, resetTemplates, silentUpdateTemplates, silentUpdateTemplateStats } = templateSlice.actions;
export default templateSlice.reducer;
