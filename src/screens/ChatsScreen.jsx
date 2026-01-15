import React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Searchbar, Avatar, List } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

const DUMMY_CHATS = [
  { id: '1', name: 'John Doe', lastMessage: 'Hey, how are you?', time: '10:30 AM', unread: 2 },
  { id: '2', name: 'Jane Smith', lastMessage: 'Thanks for your help!', time: 'Yesterday', unread: 0 },
  { id: '3', name: 'Mike Johnson', lastMessage: 'Can we schedule a call?', time: 'Monday', unread: 1 },
  { id: '4', name: 'Sarah Williams', lastMessage: 'Perfect! See you then', time: 'Sunday', unread: 0 },
];

export default function ChatsScreen() {
  const [searchQuery, setSearchQuery] = React.useState('');

  const renderChatItem = ({ item }) => (
    <List.Item
      title={item.name}
      description={item.lastMessage}
      left={(props) => (
        <Avatar.Text
          {...props}
          size={48}
          label={item.name
            .split(' ')
            .map((n) => n[0])
            .join('')}
          style={{ backgroundColor: colors.primary.main }}
        />
      )}
      right={(props) => (
        <View style={styles.chatRight}>
          <Text variant="bodySmall" style={styles.chatTime}>
            {item.time}
          </Text>
          {item.unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread}</Text>
            </View>
          )}
        </View>
      )}
      style={styles.chatItem}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.headerTitle}>
          Chats
        </Text>
        <Searchbar
          placeholder="Search chats"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />
      </View>

      <FlatList
        data={DUMMY_CHATS}
        renderItem={renderChatItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.chatList}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  header: {
    padding: 16,
    backgroundColor: colors.background.paper,
  },
  headerTitle: {
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: 12,
  },
  searchBar: {
    backgroundColor: colors.background.neutral,
  },
  chatList: {
    paddingVertical: 8,
  },
  chatItem: {
    backgroundColor: colors.background.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  chatRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  chatTime: {
    color: colors.text.secondary,
    marginBottom: 4,
  },
  unreadBadge: {
    backgroundColor: colors.primary.main,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: colors.common.white,
    fontSize: 12,
    fontWeight: '600',
  },
});
