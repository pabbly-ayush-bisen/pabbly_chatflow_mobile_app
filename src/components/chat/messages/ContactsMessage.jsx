import React, { memo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors, getAvatarColor } from '../../../theme/colors';
import { getContactData } from '../../../utils/messageHelpers';

/**
 * ContactsMessage Component
 * Renders contact card messages (single or multiple contacts)
 * Aligned with web app contacts message implementation
 */
const ContactsMessage = ({ message, isOutgoing }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const contacts = getContactData(message);

  // Render error state
  if (!contacts || contacts.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="account-off" size={24} color={colors.grey[400]} />
        <Text style={styles.errorText}>Contact not available</Text>
      </View>
    );
  }

  // Get initials from name
  const getInitials = (name) => {
    if (!name) return '?';
    return name.match(/\b\w/g)?.join('')?.slice(0, 2)?.toUpperCase() || '?';
  };

  // Handle phone call
  const handleCall = (phone) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  // Single contact view
  if (contacts.length === 1) {
    const contact = contacts[0];
    const avatarColor = getAvatarColor(contact.name);

    return (
      <View style={styles.container}>
        <View style={styles.singleContactContainer}>
          {/* Avatar */}
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarText}>{getInitials(contact.name)}</Text>
          </View>

          {/* Contact info */}
          <View style={styles.contactInfo}>
            <Text
              style={[styles.contactName, isOutgoing && styles.contactNameOutgoing]}
              numberOfLines={1}
            >
              {contact.name}
            </Text>

            {contact.phones.length > 0 ? (
              contact.phones.map((phone, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => handleCall(phone.phone)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.contactPhone, isOutgoing && styles.contactPhoneOutgoing]}
                  >
                    {phone.phone || 'N/A'}
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={[styles.contactPhone, isOutgoing && styles.contactPhoneOutgoing]}>
                No phone number
              </Text>
            )}
          </View>

          {/* Call button */}
          {contact.phones.length > 0 && (
            <TouchableOpacity
              style={styles.callButton}
              onPress={() => handleCall(contact.phones[0]?.phone)}
              activeOpacity={0.7}
            >
              <Icon name="phone" size={20} color={chatColors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // Multiple contacts view
  const primaryContact = contacts[0];
  const otherCount = contacts.length - 1;

  return (
    <View style={styles.container}>
      {/* Header with avatar group */}
      <TouchableOpacity
        style={styles.multiContactHeader}
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.7}
      >
        {/* Avatar group */}
        <View style={styles.avatarGroup}>
          {contacts.slice(0, 3).map((contact, idx) => {
            const avatarColor = getAvatarColor(contact.name);
            return (
              <View
                key={idx}
                style={[
                  styles.groupAvatar,
                  { backgroundColor: avatarColor, marginLeft: idx > 0 ? -12 : 0, zIndex: 3 - idx },
                ]}
              >
                <Text style={styles.groupAvatarText}>{getInitials(contact.name)}</Text>
              </View>
            );
          })}
        </View>

        {/* Contact summary */}
        <View style={styles.multiContactInfo}>
          <Text
            style={[styles.contactName, isOutgoing && styles.contactNameOutgoing]}
            numberOfLines={1}
          >
            {primaryContact.name}
            {otherCount > 0 ? ` and ${otherCount} other${otherCount > 1 ? 's' : ''}` : ''}
          </Text>
          <Text style={[styles.contactCount, isOutgoing && styles.contactCountOutgoing]}>
            {contacts.length} contacts
          </Text>
        </View>

        {/* Expand icon */}
        <Icon
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={24}
          color={isOutgoing ? 'rgba(255,255,255,0.7)' : colors.grey[500]}
        />
      </TouchableOpacity>

      {/* Expanded contact list */}
      {isExpanded && (
        <View style={styles.expandedList}>
          {contacts.map((contact, idx) => {
            const avatarColor = getAvatarColor(contact.name);
            return (
              <View key={idx} style={styles.expandedContact}>
                <View style={[styles.smallAvatar, { backgroundColor: avatarColor }]}>
                  <Text style={styles.smallAvatarText}>{getInitials(contact.name)}</Text>
                </View>
                <View style={styles.expandedContactInfo}>
                  <Text
                    style={[styles.expandedContactName, isOutgoing && styles.expandedContactNameOutgoing]}
                    numberOfLines={1}
                  >
                    {contact.name}
                  </Text>
                  {contact.phones.length > 0 ? (
                    <Text
                      style={[styles.expandedContactPhone, isOutgoing && styles.expandedContactPhoneOutgoing]}
                    >
                      {contact.phones[0]?.phone || 'N/A'}
                    </Text>
                  ) : (
                    <Text style={[styles.expandedContactPhone, isOutgoing && styles.expandedContactPhoneOutgoing]}>
                      No phone number
                    </Text>
                  )}
                </View>
                {contact.phones.length > 0 && (
                  <TouchableOpacity
                    onPress={() => handleCall(contact.phones[0]?.phone)}
                    activeOpacity={0.7}
                  >
                    <Icon name="phone" size={18} color={chatColors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    minWidth: 200,
    maxWidth: 280,
  },
  singleContactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: colors.common.white,
    fontSize: 16,
    fontWeight: '600',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  contactNameOutgoing: {
    color: colors.common.white,
  },
  contactPhone: {
    fontSize: 13,
    color: chatColors.primary,
    marginTop: 2,
  },
  contactPhoneOutgoing: {
    color: 'rgba(255,255,255,0.8)',
  },
  callButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  multiContactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  avatarGroup: {
    flexDirection: 'row',
    marginRight: 12,
  },
  groupAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.common.white,
  },
  groupAvatarText: {
    color: colors.common.white,
    fontSize: 11,
    fontWeight: '600',
  },
  multiContactInfo: {
    flex: 1,
  },
  contactCount: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  contactCountOutgoing: {
    color: 'rgba(255,255,255,0.7)',
  },
  expandedList: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    paddingTop: 8,
  },
  expandedContact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  smallAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  smallAvatarText: {
    color: colors.common.white,
    fontSize: 11,
    fontWeight: '600',
  },
  expandedContactInfo: {
    flex: 1,
  },
  expandedContactName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  expandedContactNameOutgoing: {
    color: colors.common.white,
  },
  expandedContactPhone: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 1,
  },
  expandedContactPhoneOutgoing: {
    color: 'rgba(255,255,255,0.7)',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.grey[100],
    borderRadius: 8,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
});

export default memo(ContactsMessage);
