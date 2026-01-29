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
  'WhatsApp Numbers': 'whatsapp',
  default: 'folder-outline',
};

/**
 * Folder color mapping based on folder name
 */
const FOLDER_COLORS = {
  Home: { bg: '#DBEAFE', icon: '#2563EB' },
  Trash: { bg: '#FEE2E2', icon: '#DC2626' },
  'WhatsApp Numbers': { bg: '#DCFCE7', icon: '#16A34A' },
  default: { bg: '#F3E8FF', icon: '#9333EA' },
};

/**
 * Nesting level colors for visual distinction
 */
const LEVEL_COLORS = [
  { bg: '#F3E8FF', border: '#9333EA' }, // Level 1 - Purple
  { bg: '#E0F2FE', border: '#0284C7' }, // Level 2 - Blue
  { bg: '#FEF3C7', border: '#D97706' }, // Level 3 - Amber
  { bg: '#DCFCE7', border: '#16A34A' }, // Level 4 - Green
];

/**
 * Reusable FolderPill component for folder selection
 * @param {object} folder - Folder object with _id, name, itemCount, count, waNumberCount, subfolders properties
 * @param {boolean} isSelected - Whether this folder is currently selected
 * @param {function} onPress - Callback when folder is pressed
 * @param {function} onExpandPress - Callback when expand arrow is pressed (for folders with subfolders)
 * @param {boolean} isExpanded - Whether the folder's subfolders are expanded
 * @param {boolean} isSubfolder - Whether this is a subfolder (nested folder)
 * @param {number} level - Nesting level (0 = root, 1 = first subfolder, etc.)
 * @param {object} style - Additional container styles
 */
const FolderPill = ({
  folder,
  isSelected,
  onPress,
  onExpandPress,
  isExpanded = false,
  isSubfolder = false,
  level = 0,
  style
}) => {
  // Guard against undefined or null folder
  if (!folder || !folder._id) {
    return null;
  }

  const iconName = FOLDER_ICONS[folder.name] || FOLDER_ICONS.default;
  const folderColor = FOLDER_COLORS[folder.name] || FOLDER_COLORS.default;
  // Support itemCount (from API), waNumberCount, and count for WhatsApp numbers in folder
  const count = folder.itemCount ?? folder.waNumberCount ?? folder.count ?? 0;
  // Check if folder has subfolders - ensure subfolders is an array with valid items
  const hasSubfolders = Array.isArray(folder.subfolders) &&
    folder.subfolders.length > 0 &&
    folder.subfolders.some(sf => sf && sf._id);

  // Get level color for visual distinction of nested folders
  const levelColor = isSubfolder ? LEVEL_COLORS[(level - 1) % LEVEL_COLORS.length] : null;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isSelected && styles.containerSelected,
        isSubfolder && styles.containerSubfolder,
        isSubfolder && levelColor && !isSelected && {
          backgroundColor: levelColor.bg,
          borderColor: levelColor.border + '60',
        },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Subfolder indent indicator with level */}
      {isSubfolder && (
        <View style={[
          styles.subfolderIndicator,
          isSelected && styles.subfolderIndicatorSelected
        ]}>
          <Icon
            name={level > 1 ? 'chevron-double-right' : 'subdirectory-arrow-right'}
            size={12}
            color={isSelected ? '#fff' : (levelColor?.border || colors.text.tertiary)}
          />
        </View>
      )}

      {/* Expand/Collapse Arrow for folders with subfolders - show for ALL levels */}
      {hasSubfolders && (
        <TouchableOpacity
          style={[
            styles.expandButton,
            isSelected && styles.expandButtonSelected,
            !isSelected && levelColor && { backgroundColor: levelColor.border + '20' }
          ]}
          onPress={(e) => {
            e.stopPropagation && e.stopPropagation();
            onExpandPress && onExpandPress(folder._id);
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon
            name={isExpanded ? 'chevron-down' : 'chevron-right'}
            size={16}
            color={isSelected ? '#fff' : (levelColor?.border || colors.text.secondary)}
          />
        </TouchableOpacity>
      )}

      {/* Icon with colored background */}
      <View style={[
        styles.iconContainer,
        { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : (isSubfolder && levelColor ? levelColor.border + '20' : folderColor.bg) }
      ]}>
        <Icon
          name={isSubfolder ? 'folder-outline' : iconName}
          size={14}
          color={isSelected ? '#fff' : (isSubfolder && levelColor ? levelColor.border : folderColor.icon)}
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
      <View style={[
        styles.badge,
        isSelected && styles.badgeSelected,
        !isSelected && isSubfolder && levelColor && { backgroundColor: levelColor.border + '15' }
      ]}>
        <Text style={[
          styles.badgeText,
          isSelected && styles.badgeTextSelected,
          !isSelected && isSubfolder && levelColor && { color: levelColor.border }
        ]}>
          {count}
        </Text>
      </View>

      {/* Subfolder count indicator - show for folders with subfolders */}
      {hasSubfolders && (
        <View style={[
          styles.subfolderBadge,
          isSelected && styles.subfolderBadgeSelected,
          !isSelected && levelColor && { backgroundColor: levelColor.border + '15' }
        ]}>
          <Icon
            name="folder-multiple-outline"
            size={10}
            color={isSelected ? '#fff' : (levelColor?.border || colors.text.tertiary)}
          />
          <Text style={[
            styles.subfolderBadgeText,
            isSelected && styles.subfolderBadgeTextSelected,
            !isSelected && levelColor && { color: levelColor.border }
          ]}>
            {folder.subfolders.filter(sf => sf && sf._id).length}
          </Text>
        </View>
      )}

      {/* Level indicator badge for deeply nested folders */}
      {level > 1 && (
        <View style={[
          styles.levelBadge,
          isSelected && styles.levelBadgeSelected,
          !isSelected && levelColor && { backgroundColor: levelColor.border + '20' }
        ]}>
          <Text style={[
            styles.levelBadgeText,
            isSelected && styles.levelBadgeTextSelected,
            !isSelected && levelColor && { color: levelColor.border }
          ]}>
            L{level}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 24,
    gap: 5,
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
  containerSubfolder: {
    backgroundColor: '#FAFBFC',
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
  },
  subfolderIndicator: {
    marginRight: 2,
  },
  subfolderIndicatorSelected: {
    opacity: 0.8,
  },
  expandButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandButtonSelected: {
    backgroundColor: 'rgba(255,255,255,0.2)',
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
    maxWidth: 80,
  },
  textSelected: {
    color: '#fff',
  },
  badge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    minWidth: 22,
    alignItems: 'center',
  },
  badgeSelected: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.primary,
  },
  badgeTextSelected: {
    color: '#fff',
  },
  subfolderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
  },
  subfolderBadgeSelected: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  subfolderBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.text.tertiary,
  },
  subfolderBadgeTextSelected: {
    color: '#fff',
  },
  levelBadge: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  levelBadgeSelected: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  levelBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: 0.3,
  },
  levelBadgeTextSelected: {
    color: '#fff',
  },
});

export default FolderPill;
