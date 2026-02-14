import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, ActivityIndicator, Searchbar, FAB } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { gotoChat } from '../redux/slices/contactSlice';
import { fetchContactsWithCache, fetchContactListsWithCache } from '../redux/cacheThunks';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, getAvatarColor } from '../theme/colors';
import { formatDistanceToNow } from 'date-fns';
import ContactBottomSheet from '../components/contacts/ContactBottomSheet';
import AddContactBottomSheet from '../components/contacts/AddContactBottomSheet';
import { ContactsListSkeleton } from '../components/common';
import { showError } from '../utils/toast';
import { useNetwork } from '../contexts/NetworkContext';

export default function ContactsScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { isOffline, isNetworkAvailable } = useNetwork();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedList, setSelectedList] = useState(null);
  const [openingChatId, setOpeningChatId] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
  const [addContactVisible, setAddContactVisible] = useState(false);
  const PAGE_SIZE = 10;

  const {
    contactListStatus,
    contactListError,
    contactListData,
    totalContactsCount,
    unassignedCount,
    contactsStatus,
    contactsError,
    contacts,
    totalCount,
  } = useSelector((state) => state.contact);

  const { settingId } = useSelector((state) => state.user);
  const prevSettingIdRef = useRef(settingId);

  const isLoadingLists = contactListStatus === 'loading';
  const isLoadingContacts = contactsStatus === 'loading';
  const isRefreshing = isLoadingLists && contactListData.length > 0;
  const isInitialContactsLoading = isLoadingContacts && contacts.length === 0;

  // Fetch contacts on mount + re-fetch with forceRefresh when account switches
  useEffect(() => {
    const isAccountSwitch = prevSettingIdRef.current !== settingId;
    prevSettingIdRef.current = settingId;

    loadContactLists(isAccountSwitch);
    loadContacts(true, null, '', isAccountSwitch);
  }, [settingId]);

  // Retry when network comes back and we have no data
  useEffect(() => {
    if (isNetworkAvailable && contacts.length === 0 && contactsStatus !== 'loading') {
      loadContactLists();
      loadContacts(true, null);
    }
  }, [isNetworkAvailable]);

  const loadContactLists = (forceRefresh = false) => {
    dispatch(fetchContactListsWithCache({ forceRefresh }));
  };

  const loadContacts = (reset = false, listName = selectedList, search = searchQuery, forceRefresh = false) => {
    const skip = reset ? 0 : contacts.length;
    dispatch(fetchContactsWithCache({
      forceRefresh,
      skip,
      limit: PAGE_SIZE,
      listName,
      search: search?.trim() || null,
    }));
  };

  const onRefresh = () => {
    loadContactLists(true);
    loadContacts(true, selectedList, searchQuery, true);
  };

  const handleAddContact = () => {
    setAddContactVisible(true);
  };

  const handleAddContactClose = () => {
    setAddContactVisible(false);
  };

  const handleAddContactSuccess = (newContact) => {
    // Force refresh from server after adding a contact
    loadContacts(true, selectedList, searchQuery, true);
    loadContactLists(true);
  };

  const handleListPress = (listName) => {
    if (listName === null) {
      setSelectedList(null);
      loadContacts(true, null);
    } else {
      setSelectedList(listName);
      loadContacts(true, listName);
    }
  };

  const getOptInStatus = (status) => {
    switch (status?.toLowerCase()) {
      case 'opted_in':
      case 'active':
        return { isOptedIn: true, color: colors.success.main };
      case 'opted_out':
      case 'inactive':
        return { isOptedIn: false, color: colors.error.main };
      default:
        return { isOptedIn: null, color: colors.grey[400] };
    }
  };

  const handleOpenChatForContact = async (contact) => {
    if (!contact?._id) return;

    try {
      setOpeningChatId(contact._id);
      const response = await dispatch(gotoChat({ id: contact._id })).unwrap();
      const data = response?.data || {};
      const chat = data.chat || data.chatData || data;
      const chatId = chat?._id || chat?.chatId || chat?.id;

      if (chatId) {
        navigation.navigate('ChatDetails', { chatId, chat });
      } else {
        showError('We could not find a chat for this contact.', 'Unable to Open Chat');
      }
    } catch (error) {
      showError(
        typeof error === 'string' ? error : error?.message || 'Something went wrong. Please try again.',
        'Unable to Open Chat'
      );
    } finally {
      setOpeningChatId(null);
    }
  };

  const filteredContacts = contacts;

  const handleLoadMoreContacts = () => {
    if (isLoadingContacts) return;
    if (contactsStatus === 'failed') return;
    if (isOffline) return;
    if (contacts.length >= (totalCount || contacts.length)) return;
    loadContacts(false);
  };

  // Contact List Filter Chip
  const renderListChip = ({ item }) => {
    // "All Contacts" pill
    if (item.isAllItem) {
      const isSelected = selectedList === null;
      return (
        <TouchableOpacity
          onPress={() => handleListPress(null)}
          activeOpacity={0.7}
          style={[styles.filterChip, isSelected && styles.filterChipSelected]}
        >
          <Icon
            name="account-group"
            size={16}
            color={isSelected ? colors.common.white : colors.text.secondary}
          />
          <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
            All
          </Text>
          <View style={[styles.filterChipBadge, isSelected && styles.filterChipBadgeSelected]}>
            <Text style={[styles.filterChipBadgeText, isSelected && styles.filterChipBadgeTextSelected]}>
              {totalContactsCount || 0}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    // "Unassigned" pill
    if (item.isUnassignedItem) {
      const isSelected = selectedList === 'Unassigned';
      return (
        <TouchableOpacity
          onPress={() => handleListPress('Unassigned')}
          activeOpacity={0.7}
          style={[styles.filterChip, isSelected && styles.filterChipSelected]}
        >
          <Icon
            name="account-off-outline"
            size={16}
            color={isSelected ? colors.common.white : colors.text.secondary}
          />
          <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
            Unassigned
          </Text>
          <View style={[styles.filterChipBadge, isSelected && styles.filterChipBadgeSelected]}>
            <Text style={[styles.filterChipBadgeText, isSelected && styles.filterChipBadgeTextSelected]}>
              {unassignedCount || 0}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    // Regular list items
    const listName = item.listName || item.name || item.title || 'Unnamed';
    const count = item.count ?? item.contactsCount ?? 0;
    const isSelected = selectedList === (item.listName || listName);

    return (
      <TouchableOpacity
        onPress={() => handleListPress(item.listName || listName)}
        activeOpacity={0.7}
        style={[styles.filterChip, isSelected && styles.filterChipSelected]}
      >
        <Icon
          name="folder-outline"
          size={16}
          color={isSelected ? colors.common.white : colors.text.secondary}
        />
        <Text
          style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}
          numberOfLines={1}
        >
          {listName}
        </Text>
        <View style={[styles.filterChipBadge, isSelected && styles.filterChipBadgeSelected]}>
          <Text style={[styles.filterChipBadgeText, isSelected && styles.filterChipBadgeTextSelected]}>
            {count}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Contact Card
  const renderContactItem = ({ item }) => {
    const hasName = item.name && item.name.trim().length > 0;
    const displayName = hasName ? item.name : 'No Name';
    const mobile = item.mobile || '';
    const countryCode = item.countryCode || '';
    const phoneNumber = mobile
      ? (countryCode && mobile.startsWith(countryCode)
          ? `${countryCode} ${mobile.slice(countryCode.length)}`
          : mobile)
      : '';
    const initials = hasName
      ? item.name.slice(0, 2).toUpperCase()
      : (phoneNumber ? phoneNumber.slice(-2) : 'NA');
    const avatarColor = getAvatarColor(hasName ? item.name : phoneNumber || 'default');
    const isOpening = openingChatId === item._id;
    const optInStatus = getOptInStatus(item.optIn?.status);

    let lastActiveLabel = null;
    if (item.lastActive) {
      try {
        lastActiveLabel = formatDistanceToNow(new Date(item.lastActive), { addSuffix: true });
      } catch {
        lastActiveLabel = null;
      }
    }

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => {
          setSelectedContact(item);
          setBottomSheetVisible(true);
        }}
        style={styles.contactCard}
      >
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.avatarText}>{initials}</Text>
          {/* Opt-in status dot */}
          <View style={[styles.statusDot, { backgroundColor: optInStatus.color }]} />
        </View>

        {/* Contact Info */}
        <View style={styles.contactInfo}>
          <View style={styles.contactHeader}>
            <Text style={[styles.contactName, !hasName && styles.noNameText]} numberOfLines={1}>
              {displayName}
            </Text>
            {lastActiveLabel && (
              <Text style={styles.lastActive} numberOfLines={1}>
                {lastActiveLabel}
              </Text>
            )}
          </View>
          <View style={styles.contactDetails}>
            <View style={styles.contactDetailRow}>
              <Icon name="whatsapp" size={14} color={phoneNumber ? "#25D366" : colors.text.tertiary} />
              <Text style={[styles.contactDetailText, !phoneNumber && styles.noPhoneText]} numberOfLines={1}>
                {phoneNumber || 'No phone number'}
              </Text>
            </View>
            {item.email && (
              <View style={styles.contactDetailRow}>
                <Icon name="email-outline" size={14} color={colors.text.tertiary} />
                <Text style={styles.contactDetailText} numberOfLines={1}>
                  {item.email}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={styles.messageButton}
          onPress={() => handleOpenChatForContact(item)}
          disabled={isOpening}
          activeOpacity={0.7}
        >
          {isOpening ? (
            <ActivityIndicator size={18} color={colors.primary.main} />
          ) : (
            <Icon name="message-text" size={20} color={colors.primary.main} />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // Empty State
  const renderEmptyState = () => {
    // Show skeleton while loading (not during refresh)
    if (isLoadingContacts && !isRefreshing) {
      return (
        <View style={styles.skeletonInListContainer}>
          <ContactsListSkeleton count={10} />
        </View>
      );
    }

    // Show offline state if offline and no contacts
    if (isOffline && contacts.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Icon name="cloud-off-outline" size={64} color={colors.grey[300]} />
          </View>
          <Text style={styles.emptyTitle}>You're Offline</Text>
          <Text style={styles.emptySubtitle}>
            Connect to the internet to load contacts.{'\n'}Previously loaded contacts will appear here.
          </Text>
        </View>
      );
    }

    // Show empty state only after loading completes with no results
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <Icon name="account-group-outline" size={64} color={colors.grey[300]} />
        </View>
        <Text style={styles.emptyTitle}>No contacts yet</Text>
        <Text style={styles.emptySubtitle}>
          {selectedList
            ? `No contacts found in "${selectedList}"`
            : 'Add your first contact to get started'}
        </Text>
        {!selectedList && (
          <TouchableOpacity style={styles.emptyButton} onPress={handleAddContact} activeOpacity={0.8}>
            <Icon name="plus" size={18} color={colors.common.white} />
            <Text style={styles.emptyButtonText}>Add Contact</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Error State (hidden when offline — cached data is already shown)
  const renderError = () => {
    if (isOffline) return null;
    const error = contactListError || contactsError;
    if (!error) return null;

    return (
      <View style={styles.errorContainer}>
        <Icon name="alert-circle-outline" size={20} color={colors.error.main} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  };

  // Loading State - Show skeleton
  if (isLoadingLists && !isRefreshing && contactListData.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Searchbar
            placeholder="Search by name, phone or email..."
            value=""
            style={styles.searchbar}
            inputStyle={styles.searchInput}
            editable={false}
          />
        </View>
        <View style={styles.skeletonContainer}>
          <ContactsListSkeleton count={12} />
        </View>
      </View>
    );
  }

  // Prepare list data: All → Unassigned → custom lists (always visible)
  const listDataWithAll = [
    { _id: 'all', isAllItem: true },
    { _id: 'unassigned', isUnassignedItem: true },
    ...contactListData,
  ];

  // Bottom Sheet Handlers
  const handleCloseBottomSheet = () => {
    setBottomSheetVisible(false);
    setSelectedContact(null);
  };

  const handleOpenChatFromSheet = async (contact) => {
    if (!contact?._id) return;

    try {
      setOpeningChatId(contact._id);
      const response = await dispatch(gotoChat({ id: contact._id })).unwrap();
      const data = response?.data || {};
      const chat = data.chat || data.chatData || data;
      const chatId = chat?._id || chat?.chatId || chat?.id;

      if (chatId) {
        // Close sheet first, then navigate
        setBottomSheetVisible(false);
        setSelectedContact(null);
        navigation.navigate('ChatDetails', { chatId, chat });
      } else {
        showError('We could not find a chat for this contact.', 'Unable to Open Chat');
      }
    } catch (error) {
      showError(
        typeof error === 'string' ? error : error?.message || 'Something went wrong. Please try again.',
        'Unable to Open Chat'
      );
    } finally {
      setOpeningChatId(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.header}>
        <Searchbar
          placeholder="Search by name, phone or email..."
          onChangeText={(text) => {
            setSearchQuery(text);
            loadContacts(true, selectedList, text);
          }}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          iconColor={colors.text.tertiary}
          placeholderTextColor={colors.text.tertiary}
        />
      </View>

      {renderError()}

      {/* Filter Chips — always show All & Unassigned, plus any custom lists */}
      <View style={styles.filtersContainer}>
        <FlatList
          data={listDataWithAll}
          renderItem={renderListChip}
          keyExtractor={(item, index) => item._id || `list-${index}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersList}
        />
      </View>

      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {selectedList ? selectedList : 'All Contacts'}
        </Text>
        <Text style={styles.sectionCount}>
          {filteredContacts.length} {filteredContacts.length === 1 ? 'contact' : 'contacts'}
        </Text>
      </View>

      {/* Contacts List */}
      {isInitialContactsLoading ? (
        <View style={styles.skeletonContainer}>
          <ContactsListSkeleton count={10} />
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          renderItem={renderContactItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.contactsList}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={[colors.primary.main]}
              tintColor={colors.primary.main}
            />
          }
          ListEmptyComponent={renderEmptyState}
          onEndReached={handleLoadMoreContacts}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isLoadingContacts && contacts.length > 0 ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.primary.main} />
                <Text style={styles.footerLoaderText}>Loading more...</Text>
              </View>
            ) : null
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* FAB */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleAddContact}
        color={colors.common.white}
      />

      {/* Contact Bottom Sheet */}
      <ContactBottomSheet
        visible={bottomSheetVisible}
        onClose={handleCloseBottomSheet}
        contact={selectedContact}
        onOpenChat={handleOpenChatFromSheet}
        isOpeningChat={openingChatId === selectedContact?._id}
      />

      {/* Add Contact Bottom Sheet */}
      <AddContactBottomSheet
        visible={addContactVisible}
        onClose={handleAddContactClose}
        onSuccess={handleAddContactSuccess}
        navigation={navigation}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 50,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.text.secondary,
  },
  skeletonContainer: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  skeletonInListContainer: {
    flex: 1,
    backgroundColor: colors.background.default,
    paddingTop: 8,
    paddingHorizontal: 16,
  },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: colors.background.default,
  },
  searchbar: {
    backgroundColor: colors.grey[100],
    borderRadius: 12,
    elevation: 0,
    shadowOpacity: 0,
    height: 48,
  },
  searchInput: {
    fontSize: 15,
    minHeight: 48,
  },

  // Filter Chips
  filtersContainer: {
    backgroundColor: colors.background.default,
    paddingBottom: 8,
  },
  filtersList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.grey[100],
    marginRight: 8,
    gap: 6,
  },
  filterChipSelected: {
    backgroundColor: colors.primary.main,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.secondary,
    maxWidth: 100,
  },
  filterChipTextSelected: {
    color: colors.common.white,
  },
  filterChipBadge: {
    backgroundColor: colors.grey[200],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  filterChipBadgeSelected: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterChipBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  filterChipBadgeTextSelected: {
    color: colors.common.white,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.default,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  sectionCount: {
    fontSize: 13,
    color: colors.text.tertiary,
  },

  // Contacts List
  contactsList: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  separator: {
    height: 1,
    backgroundColor: colors.grey[100],
    marginLeft: 68,
  },

  // Contact Card
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: colors.background.default,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.common.white,
  },
  statusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.background.default,
  },
  contactInfo: {
    flex: 1,
    marginRight: 8,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
    marginRight: 8,
  },
  noNameText: {
    fontStyle: 'italic',
    color: colors.text.tertiary,
  },
  lastActive: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  contactDetails: {
    gap: 2,
  },
  contactDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactDetailText: {
    fontSize: 13,
    color: colors.text.secondary,
    flex: 1,
  },
  noPhoneText: {
    fontStyle: 'italic',
    color: colors.text.tertiary,
  },
  messageButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary.lighter,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.main,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.common.white,
  },

  // Error
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error.lighter,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: colors.error.dark,
  },

  // Footer Loader
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  footerLoaderText: {
    fontSize: 13,
    color: colors.text.secondary,
  },

  // FAB - positioned above tab bar
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 70,
    backgroundColor: colors.primary.main,
    borderRadius: 28,
  },
});
