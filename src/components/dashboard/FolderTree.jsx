import { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
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
 * Individual Folder Item with expand/collapse for nested folders
 */
const FolderItem = ({
  folder,
  onPress,
  level = 0,
  expandedFolders,
  onToggleExpand,
  selectedFolderId,
}) => {
  const iconName = FOLDER_ICONS[folder.name] || FOLDER_ICONS.default;
  const folderColor = FOLDER_COLORS[folder.name] || FOLDER_COLORS.default;
  const count = folder.itemCount ?? folder.waNumberCount ?? folder.count ?? 0;
  const hasSubfolders = folder.subfolders && folder.subfolders.length > 0;
  const isExpanded = expandedFolders[folder._id];
  const isSelected = selectedFolderId === folder._id;

  // Calculate indentation based on level
  const indentLeft = level * 16;

  return (
    <View>
      <TouchableOpacity
        style={[
          styles.folderItem,
          { paddingLeft: 12 + indentLeft },
          isSelected && styles.folderItemSelected,
        ]}
        onPress={() => onPress(folder)}
        activeOpacity={0.7}
      >
        {/* Expand/Collapse Arrow for folders with subfolders */}
        {hasSubfolders ? (
          <TouchableOpacity
            style={styles.expandButton}
            onPress={() => onToggleExpand(folder._id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon
              name={isExpanded ? 'chevron-down' : 'chevron-right'}
              size={18}
              color={isSelected ? '#fff' : colors.text.secondary}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.expandPlaceholder} />
        )}

        {/* Folder Icon */}
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : folderColor.bg },
          ]}
        >
          <Icon
            name={iconName}
            size={15}
            color={isSelected ? '#fff' : folderColor.icon}
          />
        </View>

        {/* Folder Name */}
        <Text
          style={[styles.folderName, isSelected && styles.folderNameSelected]}
          numberOfLines={1}
        >
          {folder.name}
        </Text>

        {/* Count Badge */}
        <View style={[styles.badge, isSelected && styles.badgeSelected]}>
          <Text style={[styles.badgeText, isSelected && styles.badgeTextSelected]}>
            {count}
          </Text>
        </View>

        {/* Nested level indicator */}
        {level > 0 && (
          <View style={[styles.levelIndicator, isSelected && styles.levelIndicatorSelected]}>
            <Text style={[styles.levelText, isSelected && styles.levelTextSelected]}>
              L{level + 1}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Render subfolders if expanded */}
      {hasSubfolders && isExpanded && (
        <View style={styles.subfoldersContainer}>
          {folder.subfolders.map((subfolder) => (
            <FolderItem
              key={subfolder._id}
              folder={subfolder}
              onPress={onPress}
              level={level + 1}
              expandedFolders={expandedFolders}
              onToggleExpand={onToggleExpand}
              selectedFolderId={selectedFolderId}
            />
          ))}
        </View>
      )}
    </View>
  );
};

/**
 * FolderTree Component - Displays folders with nested hierarchy
 */
const FolderTree = ({
  folders,
  selectedFolder,
  onFolderSelect,
  maxHeight = 280,
  showHeader = true,
}) => {
  const [expandedFolders, setExpandedFolders] = useState({});

  // Auto-expand parent folders when a nested folder is selected
  useEffect(() => {
    if (selectedFolder?._id) {
      // Find and expand parent folders
      const findAndExpandParents = (folderList, targetId, parents = []) => {
        for (const folder of folderList) {
          if (folder._id === targetId) {
            return parents;
          }
          if (folder.subfolders && folder.subfolders.length > 0) {
            const found = findAndExpandParents(
              folder.subfolders,
              targetId,
              [...parents, folder._id]
            );
            if (found) return found;
          }
        }
        return null;
      };

      const allFolders = [
        ...(folders?.defaultFolders || []),
        ...(folders?.restFolders || []),
      ];

      const parentIds = findAndExpandParents(allFolders, selectedFolder._id);
      if (parentIds && parentIds.length > 0) {
        setExpandedFolders((prev) => {
          const newExpanded = { ...prev };
          parentIds.forEach((id) => {
            newExpanded[id] = true;
          });
          return newExpanded;
        });
      }
    }
  }, [selectedFolder?._id, folders]);

  const handleToggleExpand = useCallback((folderId) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  }, []);

  const defaultFolders = folders?.defaultFolders || [];
  const restFolders = folders?.restFolders || [];

  // Separate Home, Trash, and other default folders
  const homeFolder = defaultFolders.find((f) => f.name === 'Home');
  const trashFolder = defaultFolders.find((f) => f.name === 'Trash');
  const otherDefaultFolders = defaultFolders.filter(
    (f) => f.name !== 'Home' && f.name !== 'Trash'
  );

  if (!folders || (defaultFolders.length === 0 && restFolders.length === 0)) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="folder-open-outline" size={36} color={colors.grey[300]} />
        <Text style={styles.emptyText}>No folders found</Text>
      </View>
    );
  }

  // Count total folders including nested
  const countFolders = (list) => {
    let count = 0;
    (list || []).forEach((f) => {
      count += 1;
      if (f.subfolders) count += countFolders(f.subfolders);
    });
    return count;
  };
  const totalFolders = countFolders(defaultFolders) + countFolders(restFolders);

  return (
    <View style={styles.container}>
      {/* Header */}
      {showHeader && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconContainer}>
              <Icon name="folder-multiple-outline" size={18} color={colors.primary.main} />
            </View>
            <Text style={styles.headerTitle}>Folders</Text>
          </View>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{totalFolders}</Text>
          </View>
        </View>
      )}

      <ScrollView
        style={[styles.scrollView, { maxHeight }]}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {/* Home Folder (Always at top) */}
        {homeFolder && (
          <FolderItem
            folder={homeFolder}
            onPress={onFolderSelect}
            level={0}
            expandedFolders={expandedFolders}
            onToggleExpand={handleToggleExpand}
            selectedFolderId={selectedFolder?._id}
          />
        )}

        {/* Other Default Folders */}
        {otherDefaultFolders.map((folder) => (
          <FolderItem
            key={folder._id}
            folder={folder}
            onPress={onFolderSelect}
            level={0}
            expandedFolders={expandedFolders}
            onToggleExpand={handleToggleExpand}
            selectedFolderId={selectedFolder?._id}
          />
        ))}

        {/* Divider if there are rest folders */}
        {restFolders.length > 0 && (otherDefaultFolders.length > 0 || homeFolder) && (
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Custom</Text>
            <View style={styles.dividerLine} />
          </View>
        )}

        {/* Rest Folders (User-created with nesting) */}
        {restFolders.map((folder) => (
          <FolderItem
            key={folder._id}
            folder={folder}
            onPress={onFolderSelect}
            level={0}
            expandedFolders={expandedFolders}
            onToggleExpand={handleToggleExpand}
            selectedFolderId={selectedFolder?._id}
          />
        ))}

        {/* Trash Folder (Always at bottom) */}
        {trashFolder && (
          <>
            <View style={styles.trashDivider} />
            <FolderItem
              folder={trashFolder}
              onPress={onFolderSelect}
              level={0}
              expandedFolders={expandedFolders}
              onToggleExpand={handleToggleExpand}
              selectedFolderId={selectedFolder?._id}
            />
          </>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FAFBFC',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primary.main + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  headerBadge: {
    backgroundColor: colors.primary.main + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  headerBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary.main,
  },
  scrollView: {
    flexGrow: 0,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 14,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  folderItemSelected: {
    backgroundColor: colors.primary.main,
    borderBottomColor: colors.primary.main,
  },
  expandButton: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandPlaceholder: {
    width: 22,
  },
  iconContainer: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  folderNameSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    minWidth: 26,
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
  levelIndicator: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  levelIndicatorSelected: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  levelText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4F46E5',
  },
  levelTextSelected: {
    color: '#fff',
  },
  subfoldersContainer: {
    backgroundColor: '#FAFBFC',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trashDivider: {
    height: 1,
    backgroundColor: '#FEE2E2',
    marginHorizontal: 14,
    marginTop: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  bottomPadding: {
    height: 8,
  },
});

export default FolderTree;
