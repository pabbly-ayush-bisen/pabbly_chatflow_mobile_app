import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card, ActivityIndicator, Searchbar, FAB, Surface, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { getContactList, getContacts } from '../redux/slices/contactSlice';
import { colors } from '../theme/colors';

export default function ContactsScreen({ navigation }) {
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedList, setSelectedList] = useState(null);

  const {
    contactListStatus,
    contactListError,
    contactListData,
    totalContactsCount,
    contactsStatus,
    contactsError,
    contacts,
  } = useSelector((state) => state.contact);

  const isLoadingLists = contactListStatus === 'loading';
  const isLoadingContacts = contactsStatus === 'loading';
  const isRefreshing = isLoadingLists && contactListData.length > 0;

  useEffect(() => {
    loadContactLists();
  }, []);

  useEffect(() => {
    if (selectedList) {
      loadContacts(selectedList);
    } else {
      loadAllContacts();
    }
  }, [selectedList]);

  const loadContactLists = () => {
    dispatch(getContactList({ skip: 1, limit: 50 }));
  };

  const loadAllContacts = () => {
    const queries = 'skip=0&limit=50';
    dispatch(getContacts(queries));
  };

  const loadContacts = (listName) => {
    const queries = `listname=${encodeURIComponent(listName)}&skip=0&limit=50`;
    dispatch(getContacts(queries));
  };

  const onRefresh = () => {
    loadContactLists();
    if (selectedList) {
      loadContacts(selectedList);
    } else {
      loadAllContacts();
    }
  };

  const handleAddContact = () => {
    navigation.navigate('AddContact');
  };

  const handleListPress = (listName) => {
    if (selectedList === listName) {
      setSelectedList(null);
    } else {
      setSelectedList(listName);
    }
  };

  const filteredContacts = contacts.filter((contact) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const name = contact.name?.toLowerCase() || '';
    const phoneNumber = contact.phoneNumber || '';
    const email = contact.email?.toLowerCase() || '';

    return name.includes(query) ||
           phoneNumber.includes(query) ||
           email.includes(query);
  });

  const renderContactListItem = ({ item }) => (
    <TouchableOpacity onPress={() => handleListPress(item.listname)}>
      <Card
        style={[
          styles.listCard,
          selectedList === item.listname && styles.selectedListCard,
        ]}
      >
        <Card.Content>
          <View style={styles.listRow}>
            <View style={styles.listInfo}>
              <Text variant="titleMedium" style={styles.listName}>
                {item.listname}
              </Text>
              <Text variant="bodySmall" style={styles.listCount}>
                {item.count || 0} contacts
              </Text>
            </View>
            {selectedList === item.listname && (
              <Chip
                mode="flat"
                style={styles.selectedChip}
                textStyle={styles.selectedChipText}
              >
                Selected
              </Chip>
            )}
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  const renderContactItem = ({ item }) => (
    <Card style={styles.contactCard}>
      <Card.Content>
        <View style={styles.contactRow}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text variant="titleMedium" style={styles.avatarText}>
                {(item.name || item.phoneNumber || 'U')[0].toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.contactInfo}>
            <Text variant="titleMedium" style={styles.contactName}>
              {item.name || 'No Name'}
            </Text>
            <Text variant="bodyMedium" style={styles.contactPhone}>
              {item.phoneNumber}
            </Text>
            {item.email && (
              <Text variant="bodySmall" style={styles.contactEmail}>
                {item.email}
              </Text>
            )}
            {item.listname && (
              <View style={styles.tagContainer}>
                <Chip mode="outlined" compact style={styles.listTag}>
                  {item.listname}
                </Chip>
              </View>
            )}
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text variant="headlineSmall" style={styles.emptyTitle}>
        No contacts found
      </Text>
      <Text variant="bodyMedium" style={styles.emptyText}>
        {selectedList
          ? `No contacts in "${selectedList}" list`
          : 'Add your first contact to get started'}
      </Text>
    </View>
  );

  const renderError = () => {
    const error = contactListError || contactsError;
    if (!error) return null;

    return (
      <Surface style={styles.errorContainer}>
        <Text variant="bodyMedium" style={styles.errorText}>
          {error}
        </Text>
      </Surface>
    );
  };

  if (isLoadingLists && !isRefreshing && contactListData.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text variant="bodyLarge" style={styles.loadingText}>
            Loading contacts...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.headerTitle}>
          Contacts
        </Text>
        <Text variant="bodyMedium" style={styles.headerSubtitle}>
          {totalContactsCount} total contacts
        </Text>

        <Searchbar
          placeholder="Search contacts"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
        />
      </View>

      {renderError()}

      {contactListData.length > 0 && (
        <View style={styles.listsSection}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Contact Lists
          </Text>
          <FlatList
            data={contactListData}
            renderItem={renderContactListItem}
            keyExtractor={(item) => item._id || item.listname}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          />
        </View>
      )}

      <View style={styles.contactsSection}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          {selectedList ? `Contacts in "${selectedList}"` : 'All Contacts'}
        </Text>

        {isLoadingContacts ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary.main} />
          </View>
        ) : (
          <FlatList
            data={filteredContacts}
            renderItem={renderContactItem}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.contactsList}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={renderEmptyState}
          />
        )}
      </View>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleAddContact}
        label="Add Contact"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: colors.text.secondary,
  },
  header: {
    padding: 16,
    backgroundColor: colors.background.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerTitle: {
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: colors.text.secondary,
    marginBottom: 16,
  },
  searchbar: {
    backgroundColor: colors.background.neutral,
    elevation: 0,
  },
  searchInput: {
    fontSize: 14,
  },
  listsSection: {
    backgroundColor: colors.background.paper,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  horizontalList: {
    paddingHorizontal: 16,
  },
  listCard: {
    backgroundColor: colors.background.neutral,
    borderRadius: 12,
    marginRight: 12,
    minWidth: 150,
  },
  selectedListCard: {
    backgroundColor: colors.primary.lighter,
    borderWidth: 2,
    borderColor: colors.primary.main,
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listInfo: {
    flex: 1,
  },
  listName: {
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  listCount: {
    color: colors.text.secondary,
  },
  selectedChip: {
    backgroundColor: colors.primary.main,
  },
  selectedChipText: {
    color: colors.common.white,
  },
  contactsSection: {
    flex: 1,
    paddingTop: 16,
  },
  contactsList: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  contactCard: {
    backgroundColor: colors.background.paper,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 1,
  },
  contactRow: {
    flexDirection: 'row',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.common.white,
    fontWeight: '600',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  contactPhone: {
    color: colors.text.secondary,
    marginBottom: 2,
  },
  contactEmail: {
    color: colors.text.secondary,
    marginBottom: 4,
  },
  tagContainer: {
    marginTop: 4,
  },
  listTag: {
    alignSelf: 'flex-start',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
  },
  emptyTitle: {
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.text.secondary,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: colors.error.lighter,
    borderRadius: 8,
    padding: 16,
    margin: 16,
  },
  errorText: {
    color: colors.error.main,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: colors.primary.main,
  },
});
