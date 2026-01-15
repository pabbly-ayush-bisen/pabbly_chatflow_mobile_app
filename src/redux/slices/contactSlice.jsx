import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { callApi, endpoints, httpMethods } from '../../utils/axios';

// Async thunks
export const getContactList = createAsyncThunk(
  'contacts/getContactList',
  async ({ skip = 1, limit = 10, all = false }, { rejectWithValue }) => {
    try {
      const url = all
        ? `${endpoints.contacts.getContactList}/?all=true`
        : `${endpoints.contacts.getContactList}/?skip=${skip}&limit=${limit}`;

      const response = await callApi(url, httpMethods.GET);
      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch contact list');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const getContacts = createAsyncThunk(
  'contacts/getContacts',
  async (queries, { rejectWithValue }) => {
    try {
      const url = `${endpoints.contacts.getContacts}?${queries}`;
      const response = await callApi(url, httpMethods.GET);
      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch contacts');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const createContact = createAsyncThunk(
  'contacts/createContact',
  async ({ bodyData, isSingleContact, onDuplicate }, { rejectWithValue }) => {
    try {
      const url = onDuplicate
        ? `${endpoints.contacts.createContact}?onDuplicate=${onDuplicate}`
        : endpoints.contacts.createContact;

      const response = await callApi(url, httpMethods.POST, bodyData);
      if (response.status === 'error') {
        if (isSingleContact && response.data?.failedContacts?.[0]?.error) {
          return rejectWithValue(response.data.failedContacts[0].error);
        }
        return rejectWithValue(response.message || 'Failed to create contact');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateContact = createAsyncThunk(
  'contacts/updateContact',
  async ({ _id, bodyData }, { rejectWithValue }) => {
    try {
      const url = `${endpoints.contacts.updateContact}${_id}`;
      const response = await callApi(url, httpMethods.PUT, bodyData);
      if (response.status !== 'success' && response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to update contact');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteContact = createAsyncThunk(
  'contacts/deleteContact',
  async (bodyData, { rejectWithValue }) => {
    try {
      const response = await callApi(endpoints.contacts.deleteContacts, httpMethods.DELETE, bodyData);
      if (response.status !== 'success' && response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to delete contact');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const createList = createAsyncThunk(
  'contacts/createList',
  async (bodyData, { rejectWithValue }) => {
    try {
      const response = await callApi(endpoints.contacts.createList, httpMethods.POST, bodyData);
      if (response.status !== 'success' && response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to create list');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteList = createAsyncThunk(
  'contacts/deleteList',
  async ({ id, deleteContacts }, { rejectWithValue }) => {
    try {
      const url = `${endpoints.contacts.deleteList}${id}`;
      const response = await callApi(url, httpMethods.DELETE, { deleteContacts });
      if (response.status !== 'success' && response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to delete list');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const gotoChat = createAsyncThunk(
  'contacts/gotoChat',
  async ({ id }, { rejectWithValue }) => {
    try {
      const url = `${endpoints.contacts.gotoChat}/${id}`;
      const response = await callApi(url, httpMethods.GET);
      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to go to chat');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const getContactStats = createAsyncThunk(
  'contacts/getContactStats',
  async (listname, { rejectWithValue }) => {
    try {
      const url = listname
        ? `${endpoints.contacts.getContactStats}?listname=${listname}`
        : endpoints.contacts.getContactStats;

      const response = await callApi(url, httpMethods.GET);
      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch contact stats');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Initial state
const initialState = {
  contactListStatus: 'idle',
  contactListError: null,
  contactListData: [],
  totalContactsCount: 0,
  unassignedCount: 0,
  totalListCount: 0,
  shouldFetchList: false,

  contactsStatus: 'idle',
  contactsError: null,
  contacts: [],
  totalCount: 0,
  shouldFetchContacts: false,

  contactStatsStatus: 'idle',
  statsError: null,
  allContacts: 0,
  optInContacts: 0,
  optOutContacts: 0,
  shouldFetchStats: false,

  gotoChatStatus: 'idle',
  gotoChatError: null,
  gotoChatData: null,
};

// Slice
const contactSlice = createSlice({
  name: 'contacts',
  initialState,
  reducers: {
    setShouldFetchList: (state, action) => {
      state.shouldFetchList = action.payload;
    },
    setShouldFetchContacts: (state, action) => {
      state.shouldFetchContacts = action.payload;
    },
    setShouldFetchStats: (state, action) => {
      state.shouldFetchStats = action.payload;
    },
    clearContactError: (state) => {
      state.contactListError = null;
      state.contactsError = null;
      state.statsError = null;
      state.gotoChatError = null;
    },
  },
  extraReducers: (builder) => {
    // Get Contact List
    builder
      .addCase(getContactList.pending, (state) => {
        state.contactListStatus = 'loading';
        state.contactListError = null;
      })
      .addCase(getContactList.fulfilled, (state, action) => {
        state.contactListStatus = 'succeeded';
        const data = action.payload.data || action.payload;
        state.contactListData = data.contactsCount || [];
        state.totalListCount = data.totalLists || 0;
        state.totalContactsCount = data.totalContactsCount || 0;
        state.unassignedCount = data.unassignedCount || 0;
      })
      .addCase(getContactList.rejected, (state, action) => {
        state.contactListStatus = 'failed';
        state.contactListError = action.payload;
      });

    // Get Contacts
    builder
      .addCase(getContacts.pending, (state) => {
        state.contactsStatus = 'loading';
        state.contactsError = null;
      })
      .addCase(getContacts.fulfilled, (state, action) => {
        state.contactsStatus = 'succeeded';
        const data = action.payload.data || action.payload;
        state.contacts = data.contacts || [];
        state.totalCount = data.totalCount || 0;
      })
      .addCase(getContacts.rejected, (state, action) => {
        state.contactsStatus = 'failed';
        state.contactsError = action.payload;
      });

    // Create Contact
    builder
      .addCase(createContact.fulfilled, (state) => {
        state.shouldFetchList = true;
        state.shouldFetchContacts = true;
        state.shouldFetchStats = true;
      });

    // Update Contact
    builder
      .addCase(updateContact.fulfilled, (state) => {
        state.shouldFetchList = true;
        state.shouldFetchContacts = true;
      });

    // Delete Contact
    builder
      .addCase(deleteContact.fulfilled, (state) => {
        state.shouldFetchList = true;
        state.shouldFetchContacts = true;
        state.shouldFetchStats = true;
      });

    // Create List
    builder
      .addCase(createList.fulfilled, (state) => {
        state.shouldFetchList = true;
      });

    // Delete List
    builder
      .addCase(deleteList.fulfilled, (state) => {
        state.shouldFetchList = true;
      });

    // Goto Chat
    builder
      .addCase(gotoChat.pending, (state) => {
        state.gotoChatStatus = 'loading';
        state.gotoChatError = null;
      })
      .addCase(gotoChat.fulfilled, (state, action) => {
        state.gotoChatStatus = 'succeeded';
        state.gotoChatData = action.payload.data || action.payload;
      })
      .addCase(gotoChat.rejected, (state, action) => {
        state.gotoChatStatus = 'failed';
        state.gotoChatError = action.payload;
      });

    // Get Contact Stats
    builder
      .addCase(getContactStats.pending, (state) => {
        state.contactStatsStatus = 'loading';
        state.statsError = null;
      })
      .addCase(getContactStats.fulfilled, (state, action) => {
        state.contactStatsStatus = 'succeeded';
        const data = action.payload.data || action.payload;
        state.allContacts = data.allContacts || 0;
        state.optInContacts = data.optInContacts || 0;
        state.optOutContacts = data.optOutContacts || 0;
      })
      .addCase(getContactStats.rejected, (state, action) => {
        state.contactStatsStatus = 'failed';
        state.statsError = action.payload;
      });
  },
});

export const {
  setShouldFetchList,
  setShouldFetchContacts,
  setShouldFetchStats,
  clearContactError,
} = contactSlice.actions;

export default contactSlice.reducer;
