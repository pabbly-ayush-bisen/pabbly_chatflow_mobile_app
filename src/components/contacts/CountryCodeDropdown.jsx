import { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Modal,
  TouchableWithoutFeedback,
  TextInput,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { countries, DEFAULT_COUNTRY } from '../../data/countries';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DROPDOWN_MAX_HEIGHT = 350;

/**
 * CountryCodeDropdown - A beautifully designed dropdown country code picker
 * Shows a searchable dropdown list of countries when clicked
 */
const CountryCodeDropdown = ({
  selectedCountry,
  onSelectCountry,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [buttonLayout, setButtonLayout] = useState(null);
  const buttonRef = useRef(null);
  const searchInputRef = useRef(null);

  // Filter countries based on search
  const filteredCountries = searchQuery.trim()
    ? countries.filter(
        (country) =>
          country.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          country.phone.includes(searchQuery) ||
          country.code.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : countries;

  const handleSelectCountry = useCallback((country) => {
    onSelectCountry(country);
    setIsOpen(false);
    setSearchQuery('');
  }, [onSelectCountry]);

  const openDropdown = useCallback(() => {
    if (disabled) return;

    // Measure button position
    if (buttonRef.current) {
      buttonRef.current.measureInWindow((x, y, width, height) => {
        setButtonLayout({ x, y, width, height });
        setIsOpen(true);
      });
    } else {
      setIsOpen(true);
    }
  }, [disabled]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
  }, []);

  const renderCountryItem = useCallback(({ item }) => {
    const isSelected = selectedCountry?.code === item.code;
    return (
      <TouchableOpacity
        style={[styles.countryItem, isSelected && styles.countryItemSelected]}
        onPress={() => handleSelectCountry(item)}
        activeOpacity={0.6}
      >
        <View style={styles.countryFlagContainer}>
          <Text style={styles.countryFlag}>{item.flag}</Text>
        </View>
        <View style={styles.countryDetails}>
          <Text style={styles.countryName} numberOfLines={1}>
            {item.label}
          </Text>
          <Text style={styles.countryCode}>{item.code}</Text>
        </View>
        <Text style={[styles.countryPhone, isSelected && styles.countryPhoneSelected]}>
          +{item.phone}
        </Text>
        {isSelected && (
          <View style={styles.checkContainer}>
            <Icon name="check" size={16} color={colors.common.white} />
          </View>
        )}
      </TouchableOpacity>
    );
  }, [selectedCountry, handleSelectCountry]);

  // Calculate dropdown position
  const getDropdownStyle = () => {
    if (!buttonLayout) {
      return {
        top: 120,
        left: 20,
        right: 20,
      };
    }

    const dropdownTop = buttonLayout.y + buttonLayout.height + 8;
    const spaceBelow = SCREEN_HEIGHT - dropdownTop - 40;

    // Position dropdown below button, or center if not enough space
    if (spaceBelow >= DROPDOWN_MAX_HEIGHT) {
      return {
        top: dropdownTop,
        left: 20,
        right: 20,
      };
    }

    // Center the dropdown if not enough space below
    return {
      top: (SCREEN_HEIGHT - DROPDOWN_MAX_HEIGHT) / 2,
      left: 20,
      right: 20,
    };
  };

  return (
    <View style={styles.container}>
      {/* Country Code Button */}
      <TouchableOpacity
        ref={buttonRef}
        style={[styles.pickerButton, disabled && styles.pickerButtonDisabled]}
        onPress={openDropdown}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <Text style={styles.flagText}>{selectedCountry?.flag || DEFAULT_COUNTRY.flag}</Text>
        <Text style={styles.codeText}>+{selectedCountry?.phone || DEFAULT_COUNTRY.phone}</Text>
        <Icon
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.text.secondary}
        />
      </TouchableOpacity>

      {/* Dropdown Modal */}
      <Modal
        visible={isOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={closeDropdown}
        statusBarTranslucent
      >
        <TouchableWithoutFeedback onPress={closeDropdown}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.dropdownContainer, getDropdownStyle()]}>
                {/* Dropdown Header */}
                <View style={styles.dropdownHeader}>
                  <Text style={styles.dropdownTitle}>Select Country</Text>
                  <TouchableOpacity onPress={closeDropdown} style={styles.closeIconButton}>
                    <Icon name="close" size={20} color={colors.text.secondary} />
                  </TouchableOpacity>
                </View>

                {/* Search Input */}
                <View style={styles.searchContainer}>
                  <Icon name="magnify" size={20} color={colors.text.tertiary} />
                  <TextInput
                    ref={searchInputRef}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search country or code..."
                    placeholderTextColor={colors.text.tertiary}
                    style={styles.searchInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Icon name="close-circle" size={18} color={colors.text.tertiary} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Country List */}
                <FlatList
                  data={filteredCountries}
                  keyExtractor={(item) => item.code}
                  renderItem={renderCountryItem}
                  style={styles.countryList}
                  contentContainerStyle={styles.countryListContent}
                  showsVerticalScrollIndicator={true}
                  keyboardShouldPersistTaps="handled"
                  initialNumToRender={15}
                  maxToRenderPerBatch={15}
                  windowSize={5}
                  ListEmptyComponent={
                    <View style={styles.emptyState}>
                      <Icon name="map-search-outline" size={40} color={colors.grey[300]} />
                      <Text style={styles.emptyText}>No countries found</Text>
                    </View>
                  }
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },

  // Picker Button - matches TextInput height
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.common.white,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.grey[300],
    gap: 6,
    height: 48,
    minWidth: 95,
  },
  pickerButtonDisabled: {
    opacity: 0.5,
    backgroundColor: colors.grey[100],
  },
  flagText: {
    fontSize: 20,
  },
  codeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },

  // Modal Overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
  },

  // Dropdown Container
  dropdownContainer: {
    position: 'absolute',
    backgroundColor: colors.common.white,
    borderRadius: 16,
    maxHeight: DROPDOWN_MAX_HEIGHT,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
    overflow: 'hidden',
  },

  // Dropdown Header
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[100],
  },
  dropdownTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  closeIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[100],
    marginHorizontal: 12,
    marginVertical: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    padding: 0,
  },

  // Country List
  countryList: {
    flex: 1,
  },
  countryListContent: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginVertical: 2,
    borderRadius: 10,
    gap: 10,
  },
  countryItemSelected: {
    backgroundColor: colors.primary.main,
  },
  countryFlagContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  countryFlag: {
    fontSize: 22,
  },
  countryDetails: {
    flex: 1,
  },
  countryName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  countryCode: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 1,
  },
  countryPhone: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '600',
    minWidth: 50,
    textAlign: 'right',
  },
  countryPhoneSelected: {
    color: colors.common.white,
  },
  checkContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.tertiary,
  },
});

export default CountryCodeDropdown;
