import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

/**
 * Folder icon mapping based on folder name
 */
const FOLDER_ICONS = {
  Home: 'home',
  Trash: 'trash-can-outline',
  default: 'folder-outline',
};

/**
 * Folder color mapping based on folder name
 */
const FOLDER_COLORS = {
  Home: { bg: '#DBEAFE', icon: '#2563EB' },
  Trash: { bg: '#FEE2E2', icon: '#DC2626' },
  default: { bg: '#F3E8FF', icon: '#9333EA' },
};

/**
 * Reusable FolderPill component for folder selection
 * @param {object} folder - Folder object with _id, name, itemCount, count, waNumberCount properties
 * @param {boolean} isSelected - Whether this folder is currently selected
 * @param {function} onPress - Callback when folder is pressed
 * @param {object} style - Additional container styles
 */
const FolderPill = ({ folder, isSelected, onPress, style }) => {
  const iconName = FOLDER_ICONS[folder.name] || FOLDER_ICONS.default;
  const folderColor = FOLDER_COLORS[folder.name] || FOLDER_COLORS.default;
  // Support itemCount (from API), waNumberCount, and count for WhatsApp numbers in folder
  const count = folder.itemCount ?? folder.waNumberCount ?? folder.count ?? 0;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isSelected && styles.containerSelected,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Icon with colored background */}
      <View style={[
        styles.iconContainer,
        { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : folderColor.bg }
      ]}>
        <Icon
          name={iconName}
          size={14}
          color={isSelected ? '#fff' : folderColor.icon}
        />
      </View>

      {/* Folder name */}
      <Text
        style={[
          styles.text,
          isSelected && styles.textSelected,
        ]}
        numberOfLines={1}
      >
        {folder.name}
      </Text>

      {/* Count badge - always show, even if 0 */}
      <View style={[styles.badge, isSelected && styles.badgeSelected]}>
        <Text style={[styles.badgeText, isSelected && styles.badgeTextSelected]}>
          {count}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 24,
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  containerSelected: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
    shadowOpacity: 0.15,
    elevation: 3,
  },
  iconContainer: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    maxWidth: 100,
  },
  textSelected: {
    color: '#fff',
  },
  badge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeSelected: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.primary,
  },
  badgeTextSelected: {
    color: '#fff',
  },
});

export default FolderPill;
