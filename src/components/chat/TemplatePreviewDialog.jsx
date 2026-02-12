import React, { memo, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { colors, chatColors } from '../../theme/colors';
import { uploadFile } from '../../services/fileUploadService';
import { showError, showWarning, showInfo } from '../../utils/toast';
import { CustomDialog, MessagePreviewBubble } from '../common';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * TemplatePreviewDialog Component
 * A beautifully redesigned WhatsApp-style template preview with modern UI/UX
 * Features: Smooth animations, better visual hierarchy, intuitive variable inputs
 */

const TemplatePreviewDialog = ({
  visible,
  onClose,
  template,
  onSend,
  isSending = false,
}) => {
  // Animation values
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // State for variable values
  const [bodyVariables, setBodyVariables] = useState({});
  const [headerVariables, setHeaderVariables] = useState({});
  const [activeInputIndex, setActiveInputIndex] = useState(null);

  // Media upload state
  const [uploadedMedia, setUploadedMedia] = useState(null); // { uri, type, fileName, fileSize, fileUrl, mediaId }
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  // Remove media confirmation dialog state
  const [showRemoveMediaDialog, setShowRemoveMediaDialog] = useState(false);
  const [showRemoveCarouselMediaDialog, setShowRemoveCarouselMediaDialog] = useState(false);
  const [carouselMediaToRemove, setCarouselMediaToRemove] = useState(null);

  // Carousel-specific state
  const [currentCarouselIndex, setCurrentCarouselIndex] = useState(0);
  const [carouselMedia, setCarouselMedia] = useState({}); // { 0: { uri, type, fileName, fileUrl, mediaId }, 1: {...}, ... }
  const [carouselBodyVariables, setCarouselBodyVariables] = useState({}); // { 0: { '1': 'value' }, 1: {...}, ... }
  const [isUploadingCarouselMedia, setIsUploadingCarouselMedia] = useState({}); // { 0: false, 1: true, ... }

  // LTO (Limited Time Offer) template state
  const [ltoFields, setLtoFields] = useState({
    date: new Date(),
    time: new Date(),
    timeZone: '(GMT+05:30) Chennai, Kolkata, Mumbai, New Delhi',
  });

  // Location template state
  const [locationFields, setLocationFields] = useState({
    latitude: '',
    longitude: '',
    name: '',
    address: '',
  });

  // Catalog template state
  const [catalogProductId, setCatalogProductId] = useState('');

  // Authentication/Copy Code template state
  const [copyCodeValue, setCopyCodeValue] = useState('');

  // Animate on visibility change
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideAnim.setValue(0);
      fadeAnim.setValue(0);
    }
  }, [visible, slideAnim, fadeAnim]);

  // Extract template components
  const headerComponent = useMemo(() => {
    return template?.components?.find(c => c.type === 'HEADER');
  }, [template]);

  const bodyComponent = useMemo(() => {
    return template?.components?.find(c => c.type === 'BODY');
  }, [template]);

  const footerComponent = useMemo(() => {
    return template?.components?.find(c => c.type === 'FOOTER');
  }, [template]);

  const buttonsComponent = useMemo(() => {
    return template?.components?.find(c => c.type === 'BUTTONS');
  }, [template]);

  // Check if template is carousel type
  const isCarouselTemplate = useMemo(() => {
    return template?.type?.toUpperCase() === 'CAROUSEL';
  }, [template]);

  // Extract carousel cards from template components
  const carouselCards = useMemo(() => {
    if (!isCarouselTemplate) return [];
    // Carousel cards are typically in components[1].cards
    const carouselComponent = template?.components?.find(c => c.cards && Array.isArray(c.cards));
    return carouselComponent?.cards || [];
  }, [template, isCarouselTemplate]);

  // Get carousel header format (IMAGE or VIDEO) - shared across all cards
  const carouselHeaderFormat = useMemo(() => {
    if (!isCarouselTemplate || carouselCards.length === 0) return null;
    const firstCard = carouselCards[0];
    const headerComp = firstCard?.components?.find(c => c.type === 'HEADER');
    return headerComp?.format?.toUpperCase() || 'IMAGE';
  }, [isCarouselTemplate, carouselCards]);

  // Extract variables from text ({{1}}, {{2}}, {{name}}, {{email}}, etc.)
  // Matches both numeric and named placeholders — same as web app regex
  // IMPORTANT: This must be defined BEFORE carouselCardVariables which uses it
  const extractVariables = useCallback((text) => {
    if (!text) return [];
    const matches = text.match(/\{\{(.*?)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches)].map(m => m.replace(/^\{\{|\}\}$/g, ''));
  }, []);

  // Extract variables from each carousel card's body
  // Use case-insensitive matching since web app uses 'body' and API typically uses 'BODY'
  const carouselCardVariables = useMemo(() => {
    if (!isCarouselTemplate) return [];
    return carouselCards.map((card, index) => {
      const bodyComp = card?.components?.find(c => c.type?.toUpperCase() === 'BODY');
      const vars = extractVariables(bodyComp?.text);
      return { cardIndex: index, variables: vars, bodyText: bodyComp?.text || '' };
    });
  }, [isCarouselTemplate, carouselCards, extractVariables]);

  // Check if template is LTO (Limited Time Offer) type
  const isLtoTemplate = useMemo(() => {
    if (!template) return false;
    const templateType = template.type?.toUpperCase();
    // LTO templates have limited_time_offer in components
    const hasLtoComponent = template.components?.some(c => c.limited_time_offer?.has_expiration);
    return templateType === 'LTO' || hasLtoComponent;
  }, [template]);

  // Check if template is Location type
  const isLocationTemplate = useMemo(() => {
    if (!template) return false;
    const templateType = template.type?.toUpperCase();
    return templateType === 'LOCATION' || headerComponent?.format?.toUpperCase() === 'LOCATION';
  }, [template, headerComponent]);

  // Check if template is Catalog type
  const isCatalogTemplate = useMemo(() => {
    if (!template) return false;
    return template.type?.toUpperCase() === 'CATALOG';
  }, [template]);

  // Check if template is Authentication type
  const isAuthenticationTemplate = useMemo(() => {
    if (!template) return false;
    return template.category?.toUpperCase() === 'AUTHENTICATION';
  }, [template]);

  // Check if template has Copy Code button
  const hasCopyCodeButton = useMemo(() => {
    if (!template) return false;
    const buttonsComp = template.components?.find(c => c.type === 'BUTTONS');
    return buttonsComp?.buttons?.some(btn =>
      btn.type?.toLowerCase() === 'copy_code' || btn.type?.toLowerCase() === 'otp'
    );
  }, [template]);

  // Check if template has URL buttons with variables
  const urlButtonsWithVariables = useMemo(() => {
    if (!template) return [];
    const buttonsComp = template.components?.find(c => c.type === 'BUTTONS');
    return buttonsComp?.buttons?.filter(btn =>
      btn.type?.toLowerCase() === 'url' && Array.isArray(btn.example) && btn.example.length > 0
    ) || [];
  }, [template]);

  // State for URL button variables
  const [urlVariables, setUrlVariables] = useState([]);

  // Get body variables
  const bodyVars = useMemo(() => {
    return extractVariables(bodyComponent?.text);
  }, [bodyComponent, extractVariables]);

  // Get header variables (for text headers)
  const headerVars = useMemo(() => {
    if (headerComponent?.format === 'TEXT') {
      return extractVariables(headerComponent?.text);
    }
    return [];
  }, [headerComponent, extractVariables]);

  // Check if template has any variables
  const hasVariables = bodyVars.length > 0 || headerVars.length > 0;
  const totalVariables = bodyVars.length + headerVars.length;

  // Count filled variables
  const filledCount = useMemo(() => {
    const bodyFilled = bodyVars.filter(v => bodyVariables[v]?.trim()).length;
    const headerFilled = headerVars.filter(v => headerVariables[v]?.trim()).length;
    return bodyFilled + headerFilled;
  }, [bodyVars, headerVars, bodyVariables, headerVariables]);

  // Reset variables when template changes
  // Use a ref to track the previous template ID to avoid unnecessary resets
  const prevTemplateIdRef = useRef(null);

  useEffect(() => {
    // Get current template identifier (use _id, name, or stringified object)
    const currentTemplateId = template?._id || template?.name || null;

    if (template && currentTemplateId !== prevTemplateIdRef.current) {
      prevTemplateIdRef.current = currentTemplateId;

      // Extract variables directly here to avoid dependency issues
      // Matches both numeric {{1}} and named {{name}} placeholders
      const extractVarsFromText = (text) => {
        if (!text) return [];
        const matches = text.match(/\{\{(.*?)\}\}/g);
        if (!matches) return [];
        return [...new Set(matches)].map(m => m.replace(/^\{\{|\}\}$/g, ''));
      };

      const bodyComp = template?.components?.find(c => c.type?.toUpperCase() === 'BODY');
      const headerComp = template?.components?.find(c => c.type?.toUpperCase() === 'HEADER');

      const extractedBodyVars = extractVarsFromText(bodyComp?.text);
      const extractedHeaderVars = headerComp?.format?.toUpperCase() === 'TEXT'
        ? extractVarsFromText(headerComp?.text)
        : [];

      // Initialize body variables
      const newBodyVars = {};
      extractedBodyVars.forEach(v => { newBodyVars[v] = ''; });
      setBodyVariables(newBodyVars);

      // Initialize header variables
      const newHeaderVars = {};
      extractedHeaderVars.forEach(v => { newHeaderVars[v] = ''; });
      setHeaderVariables(newHeaderVars);

      // Reset media
      setUploadedMedia(null);
      setActiveInputIndex(null);

      // Reset carousel state
      setCurrentCarouselIndex(0);
      setCarouselMedia({});
      setCarouselBodyVariables({});
      setIsUploadingCarouselMedia({});

      // Reset LTO state
      setLtoFields({
        date: new Date(),
        time: new Date(),
        timeZone: '(GMT+05:30) Chennai, Kolkata, Mumbai, New Delhi',
      });

      // Reset location state
      setLocationFields({
        latitude: '',
        longitude: '',
        name: '',
        address: '',
      });

      // Reset catalog state
      setCatalogProductId('');

      // Reset authentication/copy code state
      setCopyCodeValue('');

      // Reset URL variables
      setUrlVariables([]);

      // Initialize copy code value from template if it's an auth template
      const buttonsComp = template?.components?.find(c => c.type === 'BUTTONS');
      const copyCodeBtn = buttonsComp?.buttons?.find(btn =>
        btn.type?.toLowerCase() === 'copy_code' || btn.type?.toLowerCase() === 'otp'
      );
      if (copyCodeBtn?.example) {
        setCopyCodeValue(copyCodeBtn.example);
      }

      // Initialize URL variables count based on URL buttons
      const urlBtns = buttonsComp?.buttons?.filter(btn =>
        btn.type?.toLowerCase() === 'url' && Array.isArray(btn.example) && btn.example.length > 0
      ) || [];
      if (urlBtns.length > 0) {
        setUrlVariables(new Array(urlBtns.length).fill(''));
      }

      // Initialize carousel body variables if it's a carousel template
      const templateType = template?.type?.toUpperCase();
      if (templateType === 'CAROUSEL') {
        const carouselComp = template?.components?.find(c => c.cards && Array.isArray(c.cards));
        const cards = carouselComp?.cards || [];

        const initialCarouselBodyVars = {};
        cards.forEach((card, cardIndex) => {
          const cardBodyComp = card?.components?.find(c => c.type === 'BODY');
          const cardVars = extractVarsFromText(cardBodyComp?.text);
          initialCarouselBodyVars[cardIndex] = {};
          cardVars.forEach(v => { initialCarouselBodyVars[cardIndex][v] = ''; });
        });
        setCarouselBodyVariables(initialCarouselBodyVars);

        // Log:('[TemplatePreviewDialog] Initialized carousel template:', {
        //   templateName: template.name,
        //   cardsCount: cards.length,
        //   carouselBodyVars: initialCarouselBodyVars,
        // });
      } else {
        // Log:('[TemplatePreviewDialog] Initialized variables for template:', {
        //   templateName: template.name,
        //   bodyVars: extractedBodyVars,
        //   headerVars: extractedHeaderVars,
        //   bodyText: bodyComp?.text,
        // });
      }
    }
  }, [template]);

  // Convert variable keys to 0-based positional indices for MessagePreviewBubble
  // Uses bodyVars order so both numeric ({{1}}) and named ({{name}}) vars work
  const previewBodyParams = useMemo(() => {
    const params = {};
    bodyVars.forEach((varKey, index) => {
      params[index] = bodyVariables[varKey] || '';
    });
    return params;
  }, [bodyVariables, bodyVars]);

  const previewHeaderParams = useMemo(() => {
    const params = {};
    headerVars.forEach((varKey, index) => {
      params[index] = headerVariables[varKey] || '';
    });
    return params;
  }, [headerVariables, headerVars]);

  // Check if all required variables are filled
  const allVariablesFilled = useMemo(() => {
    const bodyFilled = bodyVars.every(v => bodyVariables[v]?.trim());
    const headerFilled = headerVars.every(v => headerVariables[v]?.trim());
    return bodyFilled && headerFilled;
  }, [bodyVars, headerVars, bodyVariables, headerVariables]);

  // Check if media is required but not uploaded
  const mediaRequired = requiresMediaUpload && !uploadedMedia;

  // Get Unix timestamp for LTO templates
  const getLtoUnixTimestamp = useCallback(() => {
    if (!ltoFields.date || !ltoFields.time) return null;
    const date = new Date(ltoFields.date);
    const time = new Date(ltoFields.time);
    // Combine date and time
    const combined = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      time.getHours(),
      time.getMinutes(),
      time.getSeconds()
    );
    return combined.getTime();
  }, [ltoFields]);

  // Validate location fields are filled
  const isLocationValid = useMemo(() => {
    if (!isLocationTemplate) return true;
    return locationFields.latitude?.trim() &&
           locationFields.longitude?.trim() &&
           locationFields.name?.trim() &&
           locationFields.address?.trim();
  }, [isLocationTemplate, locationFields]);

  // Handle send
  const handleSend = useCallback(() => {
    // Handle carousel template validation
    if (isCarouselTemplate) {
      if (!allCarouselVariablesFilled && carouselFilledProgress.total > 0) {
        showWarning('Please fill in all variables for each carousel card.', 'Variables Required');
        return;
      }

      if (isAnyCarouselMediaUploading) {
        showInfo('Media is still uploading. Please wait for the upload to complete.', 'Please Wait');
        return;
      }

      if (!allCarouselMediaUploaded) {
        showWarning(
          'Please upload media for all carousel cards before sending.',
          'Media Required'
          [{ text: 'OK' }]
        );
        return;
      }

      // Build carousel-specific payload - matching web app structure
      // The server expects: { text: '...', bodyParams: { '{{1}}': 'value1', ... } }
      const carouselBodies = carouselCardVariables.map((cardVar) => {
        const cardVars = carouselBodyVariables[cardVar.cardIndex] || {};
        return {
          text: cardVar.bodyText || '', // Include body text from template card
          bodyParams: cardVar.variables.reduce((acc, v) => {
            acc[`{{${v}}}`] = cardVars[v] || '';
            return acc;
          }, {}),
        };
      });

      // Build file data array for each card - matching web app structure
      // Web app uses carouselFileData with { fileName, fileUrl, fileType }
      const carouselFileData = carouselCards.map((_, index) => {
        const media = carouselMedia[index];
        return {
          fileType: carouselHeaderFormat?.toLowerCase() || 'image',
          fileName: media?.fileName || '',
          fileUrl: media?.fileUrl || media?.uri || '',
          fileSize: media?.fileSize || 0,
          mediaId: media?.mediaId || undefined,
        };
      });

      // Build payload EXACTLY matching web app's TextTemplateTypeDialog callBackPayload
      const sendPayload = {
        templateName: template?.name,
        languageCode: template?.language || 'en',
        headerParams: {}, // Empty object for carousel (web app sends object, converts to array later)
        bodyParams: {}, // Empty object for carousel (web app sends object, converts to array later)
        fileName: '', // Empty for carousel templates
        fileUrl: '', // Empty for carousel templates
        templateType: template?.type || 'CAROUSEL',
        row: template, // Web app sends full template object as 'row'
        carouselFileData,
        carouselBodies,
      };

      // Log:('[TemplatePreviewDialog] Sending carousel template:', {
      //   templateName: template?.name,
      //   cardsCount: carouselCards.length,
      //   carouselBodies,
      //   carouselFileDataCount: carouselFileData.length,
      // });

      onSend?.(sendPayload);
      return;
    }

    // Regular template validation
    if (!allVariablesFilled && hasVariables) {
      return;
    }

    if (isUploadingMedia) {
      showInfo('Media is still uploading. Please wait for the upload to complete.', 'Please Wait');
      return;
    }

    // Validate media is uploaded for media templates
    if (requiresMediaUpload && !uploadedMedia) {
      showWarning(
        'This template requires media. Please upload an image, video, or document before sending.',
        'Media Required'
        [{ text: 'OK' }]
      );
      return;
    }

    // Validate location fields for location templates
    if (isLocationTemplate && !isLocationValid) {
      showWarning(
        'Please fill in all location fields (latitude, longitude, name, and address).',
        'Location Required'
        [{ text: 'OK' }]
      );
      return;
    }

    const bodyParams = bodyVars.map(v => bodyVariables[v] || '');
    let headerParams = headerVars.map(v => headerVariables[v] || '');

    // For media templates (IMAGE, VIDEO, DOCUMENT), include media in header parameters
    // This is required by the WhatsApp Business API
    if (requiresMediaUpload && uploadedMedia) {
      // If template has media header, we need to format it for the API
      // The media object should be the first (and usually only) header parameter
      const mediaParam = {
        type: uploadedMedia.type?.toLowerCase(), // 'image', 'video', 'document'
        [uploadedMedia.type?.toLowerCase()]: {
          link: uploadedMedia.fileUrl || uploadedMedia.uri,
          filename: uploadedMedia.fileName,
        },
      };

      // Insert media as first header parameter
      headerParams = [mediaParam, ...headerParams];
    }

    // Build send payload with all template type specific fields
    const sendPayload = {
      template,
      bodyParams,
      headerParams,
      media: uploadedMedia, // Include uploaded media for reference
      // LTO fields (for Limited Time Offer templates)
      ...(isLtoTemplate && {
        ltoFields: {
          unixTimestamp: getLtoUnixTimestamp(),
          date: ltoFields.date,
          time: ltoFields.time,
          timeZone: ltoFields.timeZone,
        },
      }),
      // Location fields (for Location templates)
      ...(isLocationTemplate && {
        location: {
          latitude: locationFields.latitude,
          longitude: locationFields.longitude,
          name: locationFields.name,
          address: locationFields.address,
        },
      }),
      // Catalog fields (for Catalog templates)
      ...(isCatalogTemplate && catalogProductId && {
        catalogProductId: catalogProductId,
      }),
      // Copy code/Authentication param
      ...(hasCopyCodeButton && copyCodeValue && {
        copyCodeParam: copyCodeValue,
      }),
      // URL button variables
      ...(urlButtonsWithVariables.length > 0 && urlVariables.length > 0 && {
        urlVariables: urlVariables,
      }),
    };

    // Log:('[TemplatePreviewDialog] Sending template:', {
    //   templateName: template?.name,
    //   templateType: template?.type,
    //   isLtoTemplate,
    //   isLocationTemplate,
    //   isCatalogTemplate,
    //   hasCopyCodeButton,
    //   requiresMediaUpload,
    //   hasMedia: !!uploadedMedia,
    //   mediaDetails: uploadedMedia ? {
    //     uri: uploadedMedia.uri,
    //     fileUrl: uploadedMedia.fileUrl,
    //     mediaId: uploadedMedia.mediaId,
    //     fileName: uploadedMedia.fileName,
    //     type: uploadedMedia.type,
    //   } : null,
    //   bodyVars,
    //   bodyVariables,
    //   bodyParams,
    //   bodyParamsCount: bodyParams.length,
    //   headerParams,
    //   headerParamsCount: headerParams.length,
    // });

    onSend?.(sendPayload);
  }, [template, bodyVars, headerVars, bodyVariables, headerVariables, allVariablesFilled, hasVariables, uploadedMedia, requiresMediaUpload, isUploadingMedia, onSend, isCarouselTemplate, allCarouselVariablesFilled, carouselFilledProgress, isAnyCarouselMediaUploading, allCarouselMediaUploaded, carouselCardVariables, carouselBodyVariables, carouselCards, carouselMedia, carouselHeaderFormat, isLtoTemplate, ltoFields, getLtoUnixTimestamp, isLocationTemplate, locationFields, isLocationValid, isCatalogTemplate, catalogProductId, hasCopyCodeButton, copyCodeValue, urlButtonsWithVariables, urlVariables]);

  // Handle close with animation
  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setBodyVariables({});
      setHeaderVariables({});
      setActiveInputIndex(null);
      setUploadedMedia(null); // Reset uploaded media
      prevTemplateIdRef.current = null; // Reset template ref for re-initialization on reopen
      // Reset carousel state
      setCurrentCarouselIndex(0);
      setCarouselMedia({});
      setCarouselBodyVariables({});
      setIsUploadingCarouselMedia({});
      onClose?.();
    });
  }, [onClose, slideAnim, fadeAnim]);

  // Get category info
  const getCategoryInfo = (category) => {
    switch (category) {
      case 'MARKETING':
        return { color: '#8E24AA', icon: 'bullhorn', label: 'Marketing' };
      case 'UTILITY':
        return { color: colors.success.main, icon: 'wrench', label: 'Utility' };
      case 'AUTHENTICATION':
        return { color: colors.info.main, icon: 'shield-check', label: 'Authentication' };
      default:
        return { color: colors.grey[500], icon: 'file-document', label: category };
    }
  };

  // Check if template requires media upload
  const requiresMediaUpload = useMemo(() => {
    if (!template) return false;

    const templateType = template.type?.toUpperCase();
    const mediaTypes = ['IMAGE', 'VIDEO', 'DOCUMENT'];

    // Check if template type is a media type
    if (mediaTypes.includes(templateType)) {
      return true;
    }

    // Check for LTO templates with media
    if (templateType === 'LTO' && headerComponent?.format) {
      const format = headerComponent.format.toUpperCase();
      return format === 'IMAGE' || format === 'VIDEO';
    }

    // Carousel templates require media for each card
    if (templateType === 'CAROUSEL') {
      return true;
    }

    return false;
  }, [template, headerComponent]);

  // Check if all carousel cards have media uploaded
  const allCarouselMediaUploaded = useMemo(() => {
    if (!isCarouselTemplate || carouselCards.length === 0) return true;
    return carouselCards.every((_, index) => carouselMedia[index]?.fileUrl || carouselMedia[index]?.uri);
  }, [isCarouselTemplate, carouselCards, carouselMedia]);

  // Check if any carousel media is uploading
  const isAnyCarouselMediaUploading = useMemo(() => {
    return Object.values(isUploadingCarouselMedia).some(v => v === true);
  }, [isUploadingCarouselMedia]);

  // Check if all carousel body variables are filled
  const allCarouselVariablesFilled = useMemo(() => {
    if (!isCarouselTemplate) return true;
    return carouselCardVariables.every((cardVar) => {
      const cardVars = carouselBodyVariables[cardVar.cardIndex] || {};
      return cardVar.variables.every(v => cardVars[v]?.trim());
    });
  }, [isCarouselTemplate, carouselCardVariables, carouselBodyVariables]);

  // Get carousel filled progress
  const carouselFilledProgress = useMemo(() => {
    if (!isCarouselTemplate) return { filled: 0, total: 0 };
    let filled = 0;
    let total = 0;
    carouselCardVariables.forEach((cardVar) => {
      total += cardVar.variables.length;
      const cardVars = carouselBodyVariables[cardVar.cardIndex] || {};
      cardVar.variables.forEach(v => {
        if (cardVars[v]?.trim()) filled++;
      });
    });
    return { filled, total };
  }, [isCarouselTemplate, carouselCardVariables, carouselBodyVariables]);

  // Get media type for template
  const getMediaType = useCallback(() => {
    const templateType = template?.type?.toUpperCase();

    if (templateType === 'IMAGE') return 'IMAGE';
    if (templateType === 'VIDEO') return 'VIDEO';
    if (templateType === 'DOCUMENT') return 'DOCUMENT';

    // For LTO, check header format
    if (templateType === 'LTO' && headerComponent?.format) {
      const format = headerComponent.format.toUpperCase();
      if (format === 'IMAGE') return 'IMAGE';
      if (format === 'VIDEO') return 'VIDEO';
    }

    return 'IMAGE'; // Default
  }, [template, headerComponent]);

  // Handle image picker
  const handlePickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showWarning('Please allow access to your photo library to upload images.', 'Permission Required');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const localMedia = {
          uri: asset.uri,
          type: 'IMAGE',
          fileName: asset.fileName || `image_${Date.now()}.jpg`,
          fileSize: asset.fileSize ? (asset.fileSize / (1024 * 1024)).toFixed(2) : '0',
        };

        // Set local preview immediately
        setUploadedMedia(localMedia);

        // Upload to server in background
        setIsUploadingMedia(true);
        try {
          const uploadResult = await uploadFile({
            uri: asset.uri,
            fileName: localMedia.fileName,
            fileType: 'image',
            mimeType: asset.mimeType || 'image/jpeg',
            fileSize: asset.fileSize,
          });

          // Update with server URL and mediaId
          setUploadedMedia({
            ...localMedia,
            fileUrl: uploadResult.url,
            mediaId: uploadResult.fileId,
          });
        } catch (uploadError) {
          // Error:('Failed to upload image:', uploadError);
          showError('Failed to upload image to server. You can still send with local file.', 'Upload Failed');
        } finally {
          setIsUploadingMedia(false);
        }
      }
    } catch (error) {
      showError('Failed to pick image. Please try again.');
      // Error:('Image picker error:', error);
    }
  }, []);

  // Handle video picker
  const handlePickVideo = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showWarning('Please allow access to your photo library to upload videos.', 'Permission Required');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 0.8,
        videoMaxDuration: 120, // 2 minutes max
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];

        // Check file size (max 16MB for videos)
        const maxSize = 16 * 1024 * 1024; // 16MB in bytes
        if (asset.fileSize && asset.fileSize > maxSize) {
          showWarning('Video must be less than 16MB. Please select a smaller video.', 'File Too Large');
          return;
        }

        const localMedia = {
          uri: asset.uri,
          type: 'VIDEO',
          fileName: asset.fileName || `video_${Date.now()}.mp4`,
          fileSize: asset.fileSize ? (asset.fileSize / (1024 * 1024)).toFixed(2) : '0',
        };

        // Set local preview immediately
        setUploadedMedia(localMedia);

        // Upload to server in background
        setIsUploadingMedia(true);
        try {
          const uploadResult = await uploadFile({
            uri: asset.uri,
            fileName: localMedia.fileName,
            fileType: 'video',
            mimeType: asset.mimeType || 'video/mp4',
            fileSize: asset.fileSize,
          });

          // Update with server URL and mediaId
          setUploadedMedia({
            ...localMedia,
            fileUrl: uploadResult.url,
            mediaId: uploadResult.fileId,
          });
        } catch (uploadError) {
          // Error:('Failed to upload video:', uploadError);
          showError('Failed to upload video to server. You can still send with local file.', 'Upload Failed');
        } finally {
          setIsUploadingMedia(false);
        }
      }
    } catch (error) {
      showError('Failed to pick video. Please try again.');
      // Error:('Video picker error:', error);
    }
  }, []);

  // Handle document picker
  const handlePickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });

      if (result.type === 'success') {
        // Check file size (max 100MB for documents)
        const maxSize = 100 * 1024 * 1024; // 100MB in bytes
        if (result.size && result.size > maxSize) {
          showWarning('Document must be less than 100MB. Please select a smaller file.', 'File Too Large');
          return;
        }

        const localMedia = {
          uri: result.uri,
          type: 'DOCUMENT',
          fileName: result.name || `document_${Date.now()}.pdf`,
          fileSize: result.size ? (result.size / (1024 * 1024)).toFixed(2) : '0',
        };

        // Set local preview immediately
        setUploadedMedia(localMedia);

        // Upload to server in background
        setIsUploadingMedia(true);
        try {
          const uploadResult = await uploadFile({
            uri: result.uri,
            fileName: localMedia.fileName,
            fileType: 'document',
            mimeType: result.mimeType || 'application/pdf',
            fileSize: result.size,
          });

          // Update with server URL and mediaId
          setUploadedMedia({
            ...localMedia,
            fileUrl: uploadResult.url,
            mediaId: uploadResult.fileId,
          });
        } catch (uploadError) {
          // Error:('Failed to upload document:', uploadError);
          showError('Failed to upload document to server. You can still send with local file.', 'Upload Failed');
        } finally {
          setIsUploadingMedia(false);
        }
      }
    } catch (error) {
      showError('Failed to pick document. Please try again.');
      // Error:('Document picker error:', error);
    }
  }, []);

  // Handle media upload based on type
  const handleMediaUpload = useCallback(() => {
    const mediaType = getMediaType();

    if (mediaType === 'IMAGE') {
      handlePickImage();
    } else if (mediaType === 'VIDEO') {
      handlePickVideo();
    } else if (mediaType === 'DOCUMENT') {
      handlePickDocument();
    }
  }, [getMediaType, handlePickImage, handlePickVideo, handlePickDocument]);

  // Handle remove media
  const handleRemoveMedia = useCallback(() => {
    setShowRemoveMediaDialog(true);
  }, []);

  // Confirm remove media
  const confirmRemoveMedia = useCallback(() => {
    setUploadedMedia(null);
    setShowRemoveMediaDialog(false);
  }, []);

  // Handle carousel card media upload (image or video based on carouselHeaderFormat)
  const handleCarouselMediaUpload = useCallback(async (cardIndex) => {
    const mediaType = carouselHeaderFormat || 'IMAGE';

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showWarning('Please allow access to your photo library to upload media.', 'Permission Required');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaType === 'VIDEO'
          ? ImagePicker.MediaTypeOptions.Videos
          : ImagePicker.MediaTypeOptions.Images,
        allowsEditing: mediaType !== 'VIDEO',
        quality: 0.8,
        ...(mediaType === 'IMAGE' && { aspect: [4, 3] }),
        ...(mediaType === 'VIDEO' && { videoMaxDuration: 120 }),
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];

        // Check file size
        const maxSize = mediaType === 'VIDEO' ? 16 * 1024 * 1024 : 5 * 1024 * 1024;
        if (asset.fileSize && asset.fileSize > maxSize) {
          showWarning(`${mediaType === 'VIDEO' ? 'Video' : 'Image'} must be less than ${mediaType === 'VIDEO' ? '16MB' : '5MB'}.`, 'File Too Large');
          return;
        }

        const localMedia = {
          uri: asset.uri,
          type: mediaType,
          fileName: asset.fileName || `${mediaType.toLowerCase()}_card${cardIndex + 1}_${Date.now()}.${mediaType === 'VIDEO' ? 'mp4' : 'jpg'}`,
          fileSize: asset.fileSize ? (asset.fileSize / (1024 * 1024)).toFixed(2) : '0',
        };

        // Set local preview immediately
        setCarouselMedia(prev => ({ ...prev, [cardIndex]: localMedia }));

        // Upload to server in background
        setIsUploadingCarouselMedia(prev => ({ ...prev, [cardIndex]: true }));
        try {
          const uploadResult = await uploadFile({
            uri: asset.uri,
            fileName: localMedia.fileName,
            fileType: mediaType.toLowerCase(),
            mimeType: asset.mimeType || (mediaType === 'VIDEO' ? 'video/mp4' : 'image/jpeg'),
            fileSize: asset.fileSize,
          });

          // Update with server URL and mediaId
          setCarouselMedia(prev => ({
            ...prev,
            [cardIndex]: {
              ...localMedia,
              fileUrl: uploadResult.url,
              mediaId: uploadResult.fileId,
            },
          }));
        } catch (uploadError) {
          // Error:(`Failed to upload carousel card ${cardIndex + 1} media:`, uploadError);
          showError(`Failed to upload media for card ${cardIndex + 1}. You can still send with local file.`, 'Upload Failed');
        } finally {
          setIsUploadingCarouselMedia(prev => ({ ...prev, [cardIndex]: false }));
        }
      }
    } catch (error) {
      showError('Failed to pick media. Please try again.');
      // Error:('Carousel media picker error:', error);
    }
  }, [carouselHeaderFormat]);

  // Handle remove carousel card media
  const handleRemoveCarouselMedia = useCallback((cardIndex) => {
    setCarouselMediaToRemove(cardIndex);
    setShowRemoveCarouselMediaDialog(true);
  }, []);

  // Confirm remove carousel media
  const confirmRemoveCarouselMedia = useCallback(() => {
    if (carouselMediaToRemove !== null) {
      setCarouselMedia(prev => {
        const newMedia = { ...prev };
        delete newMedia[carouselMediaToRemove];
        return newMedia;
      });
    }
    setShowRemoveCarouselMediaDialog(false);
    setCarouselMediaToRemove(null);
  }, [carouselMediaToRemove]);

  // Handle carousel body variable change
  const handleCarouselVariableChange = useCallback((cardIndex, varNum, value) => {
    setCarouselBodyVariables(prev => ({
      ...prev,
      [cardIndex]: {
        ...(prev[cardIndex] || {}),
        [varNum]: value,
      },
    }));
  }, []);

  // Get preview text for carousel card with variables replaced
  const getCarouselCardPreviewText = useCallback((cardIndex) => {
    if (!carouselCardVariables[cardIndex]) return '';
    const { bodyText, variables } = carouselCardVariables[cardIndex];
    const cardVars = carouselBodyVariables[cardIndex] || {};
    let result = bodyText;
    variables.forEach(v => {
      const value = cardVars[v];
      if (value?.trim()) {
        result = result.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'g'), value);
      } else {
        result = result.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'g'), `[Variable ${v}]`);
      }
    });
    return result;
  }, [carouselCardVariables, carouselBodyVariables]);

  if (!template) return null;

  const categoryInfo = getCategoryInfo(template.category);
  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  return (
    <>
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={styles.backdropTouch}
            activeOpacity={1}
            onPress={handleClose}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.container,
            { transform: [{ translateY }] },
          ]}
        >
          {/* Drag Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.dragHandle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View style={styles.headerIconContainer}>
                <Icon name="message-text-outline" size={22} color={colors.common.white} />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>Send Template</Text>
                <Text style={styles.headerSubtitle}>Preview and customize your message</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="close" size={22} color={colors.grey[600]} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Template Card */}
            <View style={styles.templateCard}>
              <View style={styles.templateCardHeader}>
                <View style={[styles.categoryIcon, { backgroundColor: categoryInfo.color + '15' }]}>
                  <Icon name={categoryInfo.icon} size={18} color={categoryInfo.color} />
                </View>
                <View style={styles.templateCardInfo}>
                  <Text style={styles.templateName} numberOfLines={1}>
                    {template.name}
                  </Text>
                  <View style={styles.templateBadges}>
                    <View style={[styles.badge, { backgroundColor: categoryInfo.color + '12' }]}>
                      <Text style={[styles.badgeText, { color: categoryInfo.color }]}>
                        {categoryInfo.label}
                      </Text>
                    </View>
                    <View style={styles.languageBadge}>
                      <Icon name="translate" size={12} color={colors.text.secondary} />
                      <Text style={styles.languageText}>
                        {template.language?.toUpperCase() || 'EN'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Message Preview Section */}
            <View style={styles.previewSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconContainer}>
                  <Icon name="eye-outline" size={16} color={chatColors.primary} />
                </View>
                <Text style={styles.sectionTitle}>Message Preview</Text>
              </View>

              <MessagePreviewBubble
                mode="template"
                templateData={template}
                templateName={template.name}
                bodyParams={previewBodyParams}
                headerParams={previewHeaderParams}
                headerFileUrl={uploadedMedia?.fileUrl || uploadedMedia?.uri || ''}
                showActualMedia={!!(uploadedMedia?.fileUrl || uploadedMedia?.uri)}
                buttonsInsideBubble={true}
                showTypeBadge={false}
                showCarousel={isCarouselTemplate}
                showLTO={isLtoTemplate}
                preservePlaceholders={false}
              />
            </View>

            {/* Media Upload Section (for non-carousel templates) */}
            {requiresMediaUpload && !isCarouselTemplate && (
              <View style={styles.mediaUploadSection}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIconContainer, { backgroundColor: colors.info.lighter }]}>
                    <Icon name="upload" size={16} color={colors.info.dark} />
                  </View>
                  <Text style={styles.sectionTitle}>Template Media</Text>
                </View>

                {!uploadedMedia ? (
                  <View style={styles.mediaUploadContainer}>
                    <Text style={styles.mediaUploadDescription}>
                      Add {getMediaType().toLowerCase()} to preview with actual content
                    </Text>
                    <TouchableOpacity
                      style={styles.uploadButton}
                      onPress={handleMediaUpload}
                      activeOpacity={0.7}
                    >
                      <View style={styles.uploadButtonIcon}>
                        <Icon
                          name={
                            getMediaType() === 'IMAGE' ? 'image-plus' :
                            getMediaType() === 'VIDEO' ? 'video-plus' :
                            'file-upload'
                          }
                          size={24}
                          color={chatColors.primary}
                        />
                      </View>
                      <Text style={styles.uploadButtonText}>
                        Upload {getMediaType().charAt(0) + getMediaType().slice(1).toLowerCase()}
                      </Text>
                      <Text style={styles.uploadButtonSubtext}>
                        Tap to select from library
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.uploadedMediaContainer}>
                    <View style={styles.uploadedMediaInfo}>
                      <View style={[styles.mediaTypeIcon, { backgroundColor: chatColors.primary + '15' }]}>
                        {isUploadingMedia ? (
                          <ActivityIndicator size="small" color={chatColors.primary} />
                        ) : (
                          <Icon
                            name={
                              uploadedMedia.type === 'IMAGE' ? 'image' :
                              uploadedMedia.type === 'VIDEO' ? 'video' :
                              'file-document'
                            }
                            size={24}
                            color={chatColors.primary}
                          />
                        )}
                      </View>
                      <View style={styles.mediaFileInfo}>
                        <Text style={styles.mediaFileName} numberOfLines={1}>
                          {uploadedMedia.fileName}
                        </Text>
                        <Text style={styles.mediaFileSize}>
                          {uploadedMedia.fileSize} MB • {uploadedMedia.type}
                          {isUploadingMedia && ' • Uploading...'}
                          {!isUploadingMedia && uploadedMedia.fileUrl && ' • Uploaded'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={handleRemoveMedia}
                        style={styles.removeMediaButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        disabled={isUploadingMedia}
                      >
                        <Icon name="close-circle" size={24} color={isUploadingMedia ? colors.grey[300] : colors.error.main} />
                      </TouchableOpacity>
                    </View>

                    {/* Replace Media Button */}
                    <TouchableOpacity
                      style={styles.replaceMediaButton}
                      onPress={handleMediaUpload}
                      activeOpacity={0.7}
                      disabled={isUploadingMedia}
                    >
                      <Icon name="refresh" size={18} color={isUploadingMedia ? colors.grey[400] : chatColors.primary} />
                      <Text style={[styles.replaceMediaText, isUploadingMedia && { color: colors.grey[400] }]}>Replace Media</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Carousel Template Section */}
            {isCarouselTemplate && carouselCards.length > 0 && (
              <View style={styles.carouselSection}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIconContainer, { backgroundColor: '#E3F2FD' }]}>
                    <Icon name="view-carousel" size={16} color="#2196F3" />
                  </View>
                  <View style={styles.sectionHeaderContent}>
                    <Text style={styles.sectionTitle}>Carousel Cards ({carouselCards.length})</Text>
                    <View style={styles.progressContainer}>
                      <View style={styles.progressBar}>
                        <Animated.View
                          style={[
                            styles.progressFill,
                            {
                              width: `${(Object.keys(carouselMedia).length / carouselCards.length) * 100}%`,
                              backgroundColor: allCarouselMediaUploaded ? colors.success.main : colors.info.main,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.progressText}>
                        {Object.keys(carouselMedia).length}/{carouselCards.length}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Carousel Card Navigation Tabs */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.carouselTabsContainer}
                  contentContainerStyle={styles.carouselTabsContent}
                >
                  {carouselCards.map((_, index) => {
                    const isActive = currentCarouselIndex === index;
                    const hasMedia = !!carouselMedia[index];
                    const isUploading = isUploadingCarouselMedia[index];

                    return (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.carouselTab,
                          isActive && styles.carouselTabActive,
                          hasMedia && styles.carouselTabWithMedia,
                        ]}
                        onPress={() => setCurrentCarouselIndex(index)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.carouselTabContent}>
                          {isUploading ? (
                            <ActivityIndicator size="small" color={isActive ? colors.common.white : chatColors.primary} />
                          ) : hasMedia ? (
                            <Icon
                              name="check-circle"
                              size={16}
                              color={isActive ? colors.common.white : colors.success.main}
                            />
                          ) : (
                            <Icon
                              name={carouselHeaderFormat === 'VIDEO' ? 'video' : 'image'}
                              size={16}
                              color={isActive ? colors.common.white : colors.grey[500]}
                            />
                          )}
                          <Text
                            style={[
                              styles.carouselTabText,
                              isActive && styles.carouselTabTextActive,
                            ]}
                          >
                            Card {index + 1}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Current Card Preview & Upload */}
                <View style={styles.carouselCardPreview}>
                  {/* Card Media Upload Area - Matching regular template upload style */}
                  {carouselMedia[currentCarouselIndex] ? (
                    <View style={styles.carouselMediaWithPreview}>
                      {carouselHeaderFormat === 'IMAGE' ? (
                        <Image
                          source={{ uri: carouselMedia[currentCarouselIndex].uri }}
                          style={styles.carouselMediaPreviewImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.carouselVideoPreview}>
                          <Image
                            source={{ uri: carouselMedia[currentCarouselIndex].uri }}
                            style={styles.carouselMediaPreviewImage}
                            resizeMode="cover"
                          />
                          <View style={styles.carouselVideoPlayButton}>
                            <Icon name="play" size={24} color={colors.common.white} />
                          </View>
                        </View>
                      )}
                      {isUploadingCarouselMedia[currentCarouselIndex] && (
                        <View style={styles.carouselUploadingOverlay}>
                          <ActivityIndicator size="large" color={colors.common.white} />
                          <Text style={styles.carouselUploadingText}>Uploading...</Text>
                        </View>
                      )}
                      {/* Remove/Replace overlay */}
                      {!isUploadingCarouselMedia[currentCarouselIndex] && (
                        <View style={styles.carouselMediaActions}>
                          <TouchableOpacity
                            style={styles.carouselMediaActionButton}
                            onPress={() => handleCarouselMediaUpload(currentCarouselIndex)}
                          >
                            <Icon name="refresh" size={18} color={colors.common.white} />
                            <Text style={styles.carouselMediaActionText}>Replace</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.carouselMediaActionButton, { backgroundColor: colors.error.main }]}
                            onPress={() => handleRemoveCarouselMedia(currentCarouselIndex)}
                          >
                            <Icon name="delete" size={18} color={colors.common.white} />
                            <Text style={styles.carouselMediaActionText}>Remove</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  ) : (
                    /* Empty state - Matching regular template upload button style */
                    <TouchableOpacity
                      style={styles.carouselUploadButton}
                      onPress={() => handleCarouselMediaUpload(currentCarouselIndex)}
                      activeOpacity={0.7}
                      disabled={isUploadingCarouselMedia[currentCarouselIndex]}
                    >
                      <View style={styles.uploadButtonIcon}>
                        <Icon
                          name={carouselHeaderFormat === 'VIDEO' ? 'video-plus' : 'image-plus'}
                          size={24}
                          color={chatColors.primary}
                        />
                      </View>
                      <Text style={styles.uploadButtonText}>
                        Upload {carouselHeaderFormat === 'VIDEO' ? 'Video' : 'Image'}
                      </Text>
                      <Text style={styles.uploadButtonSubtext}>
                        Card {currentCarouselIndex + 1} of {carouselCards.length} • Tap to select
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Card Body Preview */}
                  <View style={styles.carouselCardBody}>
                    <Text style={styles.carouselCardBodyText}>
                      {getCarouselCardPreviewText(currentCarouselIndex) || 'No body text'}
                    </Text>
                  </View>

                  {/* Card Buttons Preview */}
                  {carouselCards[currentCarouselIndex]?.components?.find(c => c.type === 'BUTTONS')?.buttons?.length > 0 && (
                    <View style={styles.carouselCardButtons}>
                      {carouselCards[currentCarouselIndex].components.find(c => c.type === 'BUTTONS').buttons.map((button, btnIndex) => (
                        <View key={btnIndex} style={styles.carouselCardButton}>
                          <Icon
                            name={button.type === 'URL' ? 'open-in-new' : button.type === 'PHONE_NUMBER' ? 'phone' : 'reply'}
                            size={14}
                            color={chatColors.primary}
                          />
                          <Text style={styles.carouselCardButtonText} numberOfLines={1}>
                            {button.text}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* Card Variables (if any) */}
                {carouselCardVariables[currentCarouselIndex]?.variables?.length > 0 && (
                  <View style={styles.carouselVariablesSection}>
                    <Text style={styles.carouselVariablesTitle}>
                      Card {currentCarouselIndex + 1} Variables
                    </Text>
                    {carouselCardVariables[currentCarouselIndex].variables.map((varNum) => {
                      const inputKey = `carousel-${currentCarouselIndex}-${varNum}`;
                      const cardVars = carouselBodyVariables[currentCarouselIndex] || {};
                      const isFilled = cardVars[varNum]?.trim();
                      const isActive = activeInputIndex === inputKey;

                      return (
                        <View
                          key={inputKey}
                          style={[
                            styles.variableInputContainer,
                            isActive && styles.variableInputContainerActive,
                            isFilled && styles.variableInputContainerFilled,
                          ]}
                        >
                          <View style={styles.variableInputHeader}>
                            <View style={styles.variableLabelRow}>
                              <View style={[
                                styles.variableNumberBadge,
                                isFilled && styles.variableNumberBadgeFilled,
                              ]}>
                                <Text style={[
                                  styles.variableNumber,
                                  isFilled && styles.variableNumberFilled,
                                ]}>
                                  {varNum}
                                </Text>
                              </View>
                              <Text style={styles.variableLabel}>Variable {varNum}</Text>
                            </View>
                            {isFilled && (
                              <Icon name="check-circle" size={18} color={colors.success.main} />
                            )}
                          </View>
                          <TextInput
                            style={styles.variableTextInput}
                            placeholder={`Enter content for variable ${varNum}`}
                            placeholderTextColor={colors.grey[400]}
                            value={cardVars[varNum] || ''}
                            onChangeText={(text) => handleCarouselVariableChange(currentCarouselIndex, varNum, text)}
                            onFocus={() => setActiveInputIndex(inputKey)}
                            onBlur={() => setActiveInputIndex(null)}
                            multiline
                          />
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Upload Status Summary */}
                <View style={styles.carouselStatusSummary}>
                  <Icon
                    name={allCarouselMediaUploaded ? 'check-circle' : 'information'}
                    size={16}
                    color={allCarouselMediaUploaded ? colors.success.main : colors.info.main}
                  />
                  <Text style={[
                    styles.carouselStatusText,
                    { color: allCarouselMediaUploaded ? colors.success.main : colors.info.main }
                  ]}>
                    {allCarouselMediaUploaded
                      ? 'All cards have media uploaded'
                      : `${Object.keys(carouselMedia).length} of ${carouselCards.length} cards have media`}
                  </Text>
                </View>
              </View>
            )}

            {/* Variables Section (for non-carousel templates) */}
            {hasVariables && !isCarouselTemplate && (
              <View style={styles.variablesSection}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIconContainer, { backgroundColor: colors.warning.lighter }]}>
                    <Icon name="form-textbox" size={16} color={colors.warning.dark} />
                  </View>
                  <View style={styles.sectionHeaderContent}>
                    <Text style={styles.sectionTitle}>Customize Variables</Text>
                    <View style={styles.progressContainer}>
                      <View style={styles.progressBar}>
                        <Animated.View
                          style={[
                            styles.progressFill,
                            {
                              width: `${(filledCount / totalVariables) * 100}%`,
                              backgroundColor: allVariablesFilled ? colors.success.main : colors.warning.main,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.progressText}>
                        {filledCount}/{totalVariables}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.variablesDescription}>
                  Fill in the dynamic content for your personalized message
                </Text>

                {/* Header Variables */}
                {headerVars.length > 0 && (
                  <View style={styles.variableGroup}>
                    <View style={styles.variableGroupHeader}>
                      <Icon name="format-title" size={14} color={colors.text.secondary} />
                      <Text style={styles.variableGroupTitle}>Header Content</Text>
                    </View>
                    {headerVars.map((varNum, index) => {
                      const inputKey = `header-${varNum}`;
                      const isFilled = headerVariables[varNum]?.trim();
                      const isActive = activeInputIndex === inputKey;

                      return (
                        <View
                          key={inputKey}
                          style={[
                            styles.variableInputContainer,
                            isActive && styles.variableInputContainerActive,
                            isFilled && styles.variableInputContainerFilled,
                          ]}
                        >
                          <View style={styles.variableInputHeader}>
                            <View style={styles.variableLabelRow}>
                              <View style={[
                                styles.variableNumberBadge,
                                isFilled && styles.variableNumberBadgeFilled,
                              ]}>
                                <Text style={[
                                  styles.variableNumber,
                                  isFilled && styles.variableNumberFilled,
                                ]}>
                                  {varNum}
                                </Text>
                              </View>
                              <Text style={styles.variableLabel}>Variable {varNum}</Text>
                            </View>
                            {isFilled && (
                              <Icon name="check-circle" size={18} color={colors.success.main} />
                            )}
                          </View>
                          <TextInput
                            style={styles.variableTextInput}
                            placeholder={`Enter content for variable ${varNum}`}
                            placeholderTextColor={colors.grey[400]}
                            value={headerVariables[varNum] || ''}
                            onChangeText={(text) => {
                              setHeaderVariables(prev => ({ ...prev, [varNum]: text }));
                            }}
                            onFocus={() => setActiveInputIndex(inputKey)}
                            onBlur={() => setActiveInputIndex(null)}
                          />
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Body Variables */}
                {bodyVars.length > 0 && (
                  <View style={styles.variableGroup}>
                    <View style={styles.variableGroupHeader}>
                      <Icon name="text" size={14} color={colors.text.secondary} />
                      <Text style={styles.variableGroupTitle}>Message Content</Text>
                    </View>
                    {bodyVars.map((varNum, index) => {
                      const inputKey = `body-${varNum}`;
                      const isFilled = bodyVariables[varNum]?.trim();
                      const isActive = activeInputIndex === inputKey;

                      return (
                        <View
                          key={inputKey}
                          style={[
                            styles.variableInputContainer,
                            isActive && styles.variableInputContainerActive,
                            isFilled && styles.variableInputContainerFilled,
                          ]}
                        >
                          <View style={styles.variableInputHeader}>
                            <View style={styles.variableLabelRow}>
                              <View style={[
                                styles.variableNumberBadge,
                                isFilled && styles.variableNumberBadgeFilled,
                              ]}>
                                <Text style={[
                                  styles.variableNumber,
                                  isFilled && styles.variableNumberFilled,
                                ]}>
                                  {varNum}
                                </Text>
                              </View>
                              <Text style={styles.variableLabel}>Variable {varNum}</Text>
                            </View>
                            {isFilled && (
                              <Icon name="check-circle" size={18} color={colors.success.main} />
                            )}
                          </View>
                          <TextInput
                            style={styles.variableTextInput}
                            placeholder={`Enter content for variable ${varNum}`}
                            placeholderTextColor={colors.grey[400]}
                            value={bodyVariables[varNum] || ''}
                            onChangeText={(text) => {
                              setBodyVariables(prev => ({ ...prev, [varNum]: text }));
                            }}
                            onFocus={() => setActiveInputIndex(inputKey)}
                            onBlur={() => setActiveInputIndex(null)}
                            multiline
                          />
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Location Fields Section (for Location templates) */}
            {isLocationTemplate && (
              <View style={styles.specialFieldsSection}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIconContainer, { backgroundColor: '#FFEBEE' }]}>
                    <Icon name="map-marker" size={16} color="#F44336" />
                  </View>
                  <Text style={styles.sectionTitle}>Location Details</Text>
                </View>
                <Text style={styles.variablesDescription}>
                  Enter the location coordinates and details
                </Text>

                <View style={styles.locationFieldRow}>
                  <View style={styles.locationFieldHalf}>
                    <Text style={styles.inputLabel}>Latitude *</Text>
                    <TextInput
                      style={[styles.variableTextInput, styles.locationInput]}
                      placeholder="e.g., 28.6139"
                      placeholderTextColor={colors.grey[400]}
                      value={locationFields.latitude}
                      onChangeText={(text) => setLocationFields(prev => ({ ...prev, latitude: text }))}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.locationFieldHalf}>
                    <Text style={styles.inputLabel}>Longitude *</Text>
                    <TextInput
                      style={[styles.variableTextInput, styles.locationInput]}
                      placeholder="e.g., 77.2090"
                      placeholderTextColor={colors.grey[400]}
                      value={locationFields.longitude}
                      onChangeText={(text) => setLocationFields(prev => ({ ...prev, longitude: text }))}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <Text style={styles.inputLabel}>Location Name *</Text>
                <TextInput
                  style={[styles.variableTextInput, styles.locationInput]}
                  placeholder="e.g., Pabbly Office"
                  placeholderTextColor={colors.grey[400]}
                  value={locationFields.name}
                  onChangeText={(text) => setLocationFields(prev => ({ ...prev, name: text }))}
                />

                <Text style={styles.inputLabel}>Full Address *</Text>
                <TextInput
                  style={[styles.variableTextInput, styles.locationInput, { minHeight: 60 }]}
                  placeholder="Enter the complete address"
                  placeholderTextColor={colors.grey[400]}
                  value={locationFields.address}
                  onChangeText={(text) => setLocationFields(prev => ({ ...prev, address: text }))}
                  multiline
                />

                <View style={styles.locationHintContainer}>
                  <Icon name="information-outline" size={16} color={colors.text.secondary} />
                  <Text style={styles.locationHintText}>
                    Enter coordinates manually or copy from Google Maps
                  </Text>
                </View>
              </View>
            )}

            {/* LTO Fields Section (for Limited Time Offer templates) */}
            {isLtoTemplate && (
              <View style={styles.specialFieldsSection}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIconContainer, { backgroundColor: '#FFF3E0' }]}>
                    <Icon name="clock-outline" size={16} color="#FF9800" />
                  </View>
                  <Text style={styles.sectionTitle}>Limited Time Offer</Text>
                </View>
                <Text style={styles.variablesDescription}>
                  Set the expiration date and time for this offer
                </Text>

                <Text style={styles.inputLabel}>Expiration Date & Time</Text>
                <View style={styles.ltoDateTimeRow}>
                  <TouchableOpacity
                    style={[styles.ltoDateTimeButton, { flex: 1, marginRight: 8 }]}
                    onPress={() => {
                      // For now, show a simple date representation
                      showInfo(`Current: ${ltoFields.date.toLocaleDateString()}\n\nNote: In production, integrate a date picker component.`, 'Date Selection');
                    }}
                  >
                    <Icon name="calendar" size={18} color={chatColors.primary} />
                    <Text style={styles.ltoDateTimeText}>
                      {ltoFields.date.toLocaleDateString()}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.ltoDateTimeButton, { flex: 1 }]}
                    onPress={() => {
                      showInfo(`Current: ${ltoFields.time.toLocaleTimeString()}\n\nNote: In production, integrate a time picker component.`, 'Time Selection');
                    }}
                  >
                    <Icon name="clock-outline" size={18} color={chatColors.primary} />
                    <Text style={styles.ltoDateTimeText}>
                      {ltoFields.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>Time Zone</Text>
                <View style={styles.ltoTimezoneContainer}>
                  <Icon name="earth" size={18} color={colors.grey[500]} style={{ marginRight: 8 }} />
                  <Text style={styles.ltoTimezoneText} numberOfLines={1}>
                    {ltoFields.timeZone}
                  </Text>
                </View>
              </View>
            )}

            {/* Catalog Fields Section (for Catalog templates) */}
            {isCatalogTemplate && (
              <View style={styles.specialFieldsSection}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIconContainer, { backgroundColor: '#E8F5E9' }]}>
                    <Icon name="shopping" size={16} color="#4CAF50" />
                  </View>
                  <Text style={styles.sectionTitle}>Catalog Product</Text>
                </View>
                <Text style={styles.variablesDescription}>
                  Optionally select a product to highlight
                </Text>

                <Text style={styles.inputLabel}>Product ID (Optional)</Text>
                <TextInput
                  style={[styles.variableTextInput, styles.locationInput]}
                  placeholder="Enter product retailer ID"
                  placeholderTextColor={colors.grey[400]}
                  value={catalogProductId}
                  onChangeText={setCatalogProductId}
                />
              </View>
            )}

            {/* Authentication/Copy Code Section */}
            {hasCopyCodeButton && !isAuthenticationTemplate && (
              <View style={styles.specialFieldsSection}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIconContainer, { backgroundColor: '#E3F2FD' }]}>
                    <Icon name="content-copy" size={16} color="#2196F3" />
                  </View>
                  <Text style={styles.sectionTitle}>Copy Code Value</Text>
                </View>
                <Text style={styles.variablesDescription}>
                  Enter the code that users can copy
                </Text>

                <TextInput
                  style={[styles.variableTextInput, styles.locationInput]}
                  placeholder="Enter code value"
                  placeholderTextColor={colors.grey[400]}
                  value={copyCodeValue}
                  onChangeText={setCopyCodeValue}
                />
              </View>
            )}

            {/* Authentication Template Section */}
            {isAuthenticationTemplate && (
              <View style={styles.specialFieldsSection}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIconContainer, { backgroundColor: '#E8EAF6' }]}>
                    <Icon name="shield-check" size={16} color="#3F51B5" />
                  </View>
                  <Text style={styles.sectionTitle}>Authentication Code</Text>
                </View>
                <Text style={styles.variablesDescription}>
                  Enter the OTP or verification code
                </Text>

                <View style={styles.authCodeContainer}>
                  <View style={styles.authParamLabel}>
                    <Text style={styles.authParamText}>{'{{1}}'}</Text>
                  </View>
                  <TextInput
                    style={[styles.variableTextInput, styles.authCodeInput]}
                    placeholder="Enter verification code"
                    placeholderTextColor={colors.grey[400]}
                    value={copyCodeValue}
                    onChangeText={setCopyCodeValue}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            )}

            {/* URL Button Variables Section */}
            {urlButtonsWithVariables.length > 0 && (
              <View style={styles.specialFieldsSection}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIconContainer, { backgroundColor: '#F3E5F5' }]}>
                    <Icon name="link-variant" size={16} color="#9C27B0" />
                  </View>
                  <Text style={styles.sectionTitle}>URL Variables</Text>
                </View>
                <Text style={styles.variablesDescription}>
                  Dynamic values to append to button URLs
                </Text>

                {urlButtonsWithVariables.map((btn, index) => (
                  <View key={index} style={{ marginBottom: 12 }}>
                    <Text style={styles.inputLabel}>URL Variable {index + 1}</Text>
                    <TextInput
                      style={[styles.variableTextInput, styles.locationInput]}
                      placeholder={`Enter value for URL variable ${index + 1}`}
                      placeholderTextColor={colors.grey[400]}
                      value={urlVariables[index] || ''}
                      onChangeText={(text) => {
                        setUrlVariables(prev => {
                          const newVars = [...prev];
                          newVars[index] = text;
                          return newVars;
                        });
                      }}
                    />
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.footer}>
            {isUploadingMedia && (
              <View style={styles.warningBanner}>
                <ActivityIndicator size="small" color={colors.info.dark} />
                <Text style={[styles.warningText, { color: colors.info.dark }]}>
                  Uploading media to server...
                </Text>
              </View>
            )}
            {mediaRequired && !isUploadingMedia && !isCarouselTemplate && (
              <View style={[styles.warningBanner, { backgroundColor: colors.error.lighter }]}>
                <Icon name="image-plus" size={16} color={colors.error.dark} />
                <Text style={[styles.warningText, { color: colors.error.dark }]}>
                  Upload {getMediaType().toLowerCase()} to send this template
                </Text>
              </View>
            )}
            {/* Carousel media warning */}
            {isCarouselTemplate && !allCarouselMediaUploaded && !isAnyCarouselMediaUploading && (
              <View style={[styles.warningBanner, { backgroundColor: colors.error.lighter }]}>
                <Icon name="view-carousel" size={16} color={colors.error.dark} />
                <Text style={[styles.warningText, { color: colors.error.dark }]}>
                  Upload media for all {carouselCards.length} carousel cards
                </Text>
              </View>
            )}
            {/* Carousel variables warning */}
            {isCarouselTemplate && allCarouselMediaUploaded && !allCarouselVariablesFilled && carouselFilledProgress.total > 0 && (
              <View style={styles.warningBanner}>
                <Icon name="form-textbox" size={16} color={colors.warning.dark} />
                <Text style={styles.warningText}>
                  Fill {carouselFilledProgress.total - carouselFilledProgress.filled} remaining variable(s)
                </Text>
              </View>
            )}
            {hasVariables && !allVariablesFilled && !isUploadingMedia && !mediaRequired && !isCarouselTemplate && (
              <View style={styles.warningBanner}>
                <Icon name="information-outline" size={16} color={colors.warning.dark} />
                <Text style={styles.warningText}>
                  Complete all {totalVariables - filledCount} remaining variable{totalVariables - filledCount !== 1 ? 's' : ''} to send
                </Text>
              </View>
            )}
            {/* Location fields warning */}
            {isLocationTemplate && !isLocationValid && (
              <View style={[styles.warningBanner, { backgroundColor: colors.error.lighter }]}>
                <Icon name="map-marker" size={16} color={colors.error.dark} />
                <Text style={[styles.warningText, { color: colors.error.dark }]}>
                  Fill in all location fields to send
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[
                styles.sendButton,
                (isCarouselTemplate
                  ? (!allCarouselMediaUploaded || isAnyCarouselMediaUploading || (!allCarouselVariablesFilled && carouselFilledProgress.total > 0))
                  : ((!allVariablesFilled && hasVariables) || isUploadingMedia || mediaRequired || (isLocationTemplate && !isLocationValid))
                ) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={
                isSending ||
                (isCarouselTemplate
                  ? (!allCarouselMediaUploaded || isAnyCarouselMediaUploading || (!allCarouselVariablesFilled && carouselFilledProgress.total > 0))
                  : ((!allVariablesFilled && hasVariables) || isUploadingMedia || mediaRequired || (isLocationTemplate && !isLocationValid))
                )
              }
              activeOpacity={0.8}
            >
              {isSending || isUploadingMedia || isAnyCarouselMediaUploading ? (
                <ActivityIndicator size="small" color={colors.common.white} />
              ) : (
                <>
                  <Icon
                    name={
                      isCarouselTemplate
                        ? (allCarouselMediaUploaded && (allCarouselVariablesFilled || carouselFilledProgress.total === 0) ? 'send' : 'lock-outline')
                        : ((allVariablesFilled || !hasVariables) && !isUploadingMedia && !mediaRequired && isLocationValid ? 'send' : 'lock-outline')
                    }
                    size={20}
                    color={colors.common.white}
                  />
                  <Text style={styles.sendButtonText}>
                    {isCarouselTemplate
                      ? (isAnyCarouselMediaUploading
                        ? 'Uploading...'
                        : !allCarouselMediaUploaded
                        ? 'Upload All Media'
                        : (!allCarouselVariablesFilled && carouselFilledProgress.total > 0)
                        ? 'Fill Variables'
                        : 'Send Carousel')
                      : (isUploadingMedia
                        ? 'Uploading Media...'
                        : mediaRequired
                        ? 'Upload Media First'
                        : (isLocationTemplate && !isLocationValid)
                        ? 'Fill Location Fields'
                        : (allVariablesFilled || !hasVariables)
                        ? 'Send Template'
                        : 'Fill Variables First')
                    }
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>

      {/* Remove Media Confirmation Dialog */}
      <CustomDialog
        visible={showRemoveMediaDialog}
        onDismiss={() => setShowRemoveMediaDialog(false)}
        icon="image-remove"
        iconColor={colors.error.main}
        title="Remove Media"
        message="Are you sure you want to remove the uploaded media?"
        actions={[
          {
            label: 'Cancel',
            onPress: () => setShowRemoveMediaDialog(false),
          },
          {
            label: 'Remove',
            onPress: confirmRemoveMedia,
            destructive: true,
          },
        ]}
      />

      {/* Remove Carousel Media Confirmation Dialog */}
      <CustomDialog
        visible={showRemoveCarouselMediaDialog}
        onDismiss={() => {
          setShowRemoveCarouselMediaDialog(false);
          setCarouselMediaToRemove(null);
        }}
        icon="image-remove"
        iconColor={colors.error.main}
        title="Remove Card Media"
        message="Are you sure you want to remove the media from this carousel card?"
        actions={[
          {
            label: 'Cancel',
            onPress: () => {
              setShowRemoveCarouselMediaDialog(false);
              setCarouselMediaToRemove(null);
            },
          },
          {
            label: 'Remove',
            onPress: confirmRemoveCarouselMedia,
            destructive: true,
          },
        ]}
      />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  backdropTouch: {
    flex: 1,
  },
  container: {
    backgroundColor: colors.common.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.95,
    minHeight: SCREEN_HEIGHT * 0.75,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  handleContainer: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 4,
  },
  dragHandle: {
    width: 36,
    height: 4,
    backgroundColor: colors.grey[300],
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[100],
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: chatColors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.grey[100],
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // Template Card
  templateCard: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: colors.grey[50],
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.grey[100],
  },
  templateCardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  templateCardInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: 6,
  },
  templateBadges: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  languageBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.grey[100],
    borderRadius: 6,
  },
  languageText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.text.secondary,
  },

  // Preview Section
  previewSection: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: chatColors.primary + "15",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  sectionHeaderContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
    letterSpacing: -0.2,
  },

  // Variables Section
  variablesSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  progressBar: {
    width: 60,
    height: 4,
    backgroundColor: colors.grey[200],
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  variablesDescription: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  variableGroup: {
    marginBottom: 16,
  },
  variableGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[100],
  },
  variableGroupTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  variableInputContainer: {
    backgroundColor: colors.common.white,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.grey[200],
    marginBottom: 10,
    overflow: "hidden",
    transition: "all 0.2s ease",
  },
  variableInputContainerActive: {
    borderColor: colors.grey[400],
  },
  variableInputContainerFilled: {
    borderColor: colors.success.light,
  },
  variableInputHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  variableLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  variableNumberBadge: {
    paddingTop: 4,
    paddingLeft: 4,
    paddingRight: 4,
    paddingBottom: 4,
    borderRadius: 6,
    backgroundColor: colors.grey[100],
    justifyContent: "center",
    alignItems: "center",
  },
  variableNumberBadgeFilled: {
    backgroundColor: colors.success.main + "20",
  },
  variableNumber: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text.secondary,
  },
  variableNumberFilled: {
    color: colors.success.main,
  },
  variableLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.primary,
  },
  variableTextInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text.primary,
    minHeight: 44,
  },

  // Footer
  footer: {
    padding: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
    borderTopWidth: 1,
    borderTopColor: colors.grey[100],
    backgroundColor: colors.common.white,
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.warning.lighter,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  warningText: {
    fontSize: 12,
    color: colors.warning.dark,
    fontWeight: "500",
    flex: 1,
  },
  sendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: chatColors.accent,
    borderRadius: 14,
    paddingVertical: 15,
    gap: 10,
    shadowColor: chatColors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  sendButtonDisabled: {
    backgroundColor: colors.grey[300],
    shadowOpacity: 0,
    elevation: 0,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.common.white,
    letterSpacing: 0.2,
  },

  // Media Upload Section Styles
  mediaUploadSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: colors.common.white,
  },
  mediaUploadContainer: {
    marginTop: 12,
  },
  mediaUploadDescription: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 12,
    textAlign: "center",
  },
  uploadButton: {
    backgroundColor: colors.grey[50],
    borderWidth: 2,
    borderColor: chatColors.primary + "40",
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadButtonIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: chatColors.primary + "15",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: 4,
  },
  uploadButtonSubtext: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  uploadedMediaContainer: {
    marginTop: 12,
  },
  uploadedMediaInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.grey[50],
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  mediaTypeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  mediaFileInfo: {
    flex: 1,
    marginRight: 12,
  },
  mediaFileName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: 4,
  },
  mediaFileSize: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  removeMediaButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  replaceMediaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.common.white,
    borderWidth: 1,
    borderColor: chatColors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
  },
  replaceMediaText: {
    fontSize: 14,
    fontWeight: "600",
    color: chatColors.primary,
  },

  // Carousel Section Styles
  carouselSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  carouselTabsContainer: {
    marginTop: 12,
    marginBottom: 16,
  },
  carouselTabsContent: {
    paddingHorizontal: 4,
    gap: 8,
  },
  carouselTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.grey[100],
    borderWidth: 1,
    borderColor: colors.grey[200],
    marginRight: 8,
  },
  carouselTabActive: {
    backgroundColor: chatColors.primary,
    borderColor: chatColors.primary,
  },
  carouselTabWithMedia: {
    borderColor: colors.success.main,
  },
  carouselTabContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  carouselTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.primary,
  },
  carouselTabTextActive: {
    color: colors.common.white,
  },
  carouselCardPreview: {
    backgroundColor: colors.grey[50],
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.grey[200],
  },
  // Carousel upload button - matching regular template upload style
  carouselUploadButton: {
    backgroundColor: colors.grey[50],
    borderWidth: 2,
    borderColor: chatColors.primary + "40",
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 24,
    margin: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 160,
  },
  carouselMediaWithPreview: {
    height: 200,
    backgroundColor: colors.grey[900],
    position: "relative",
  },
  carouselMediaPreviewImage: {
    width: "100%",
    height: "100%",
  },
  carouselVideoPreview: {
    width: "100%",
    height: "100%",
    position: "relative",
  },
  carouselVideoPlayButton: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -25,
    marginLeft: -25,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  carouselUploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  carouselUploadingText: {
    color: colors.common.white,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
  },
  carouselMediaActions: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  carouselMediaActionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  carouselMediaActionText: {
    color: colors.common.white,
    fontSize: 13,
    fontWeight: "600",
  },
  // Keep old styles for backward compatibility (can be removed later)
  carouselMediaPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  carouselMediaPlaceholderIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: chatColors.primary + "15",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  carouselMediaPlaceholderText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: 4,
  },
  carouselMediaPlaceholderSubtext: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  carouselCardBody: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.grey[200],
  },
  carouselCardBodyText: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
  },
  carouselCardButtons: {
    borderTopWidth: 1,
    borderTopColor: colors.grey[200],
    paddingVertical: 8,
  },
  carouselCardButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[100],
  },
  carouselCardButtonText: {
    fontSize: 13,
    color: chatColors.primary,
    fontWeight: "600",
  },
  carouselVariablesSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.grey[200],
    backgroundColor: colors.common.white,
  },
  carouselVariablesTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.secondary,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  carouselStatusSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    backgroundColor: colors.grey[50],
    borderRadius: 10,
    marginTop: 16,
  },
  carouselStatusText: {
    fontSize: 13,
    fontWeight: "500",
  },

  // Special Template Fields Styles (Location, LTO, Catalog, Authentication)
  specialFieldsSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.secondary,
    marginBottom: 6,
    marginTop: 12,
  },
  locationFieldRow: {
    flexDirection: "row",
    gap: 12,
  },
  locationFieldHalf: {
    flex: 1,
  },
  locationInput: {
    backgroundColor: colors.grey[50],
    borderWidth: 1,
    borderColor: colors.grey[200],
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text.primary,
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: chatColors.primary + "12",
    borderRadius: 10,
    marginTop: 16,
    gap: 8,
  },
  locationButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: chatColors.primary,
  },
  locationHintContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.grey[50],
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  locationHintText: {
    flex: 1,
    fontSize: 12,
    color: colors.text.secondary,
  },
  ltoDateTimeRow: {
    flexDirection: "row",
    marginTop: 8,
  },
  ltoDateTimeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.grey[50],
    borderWidth: 1,
    borderColor: colors.grey[200],
    borderRadius: 10,
    gap: 8,
  },
  ltoDateTimeText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text.primary,
  },
  ltoTimezoneContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.grey[50],
    borderWidth: 1,
    borderColor: colors.grey[200],
    borderRadius: 10,
    marginTop: 8,
  },
  ltoTimezoneText: {
    flex: 1,
    fontSize: 13,
    color: colors.text.secondary,
  },
  authCodeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  authParamLabel: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.grey[100],
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.grey[200],
  },
  authParamText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  authCodeInput: {
    flex: 1,
    backgroundColor: colors.grey[50],
    borderWidth: 1,
    borderColor: colors.grey[200],
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text.primary,
  },
});

export default memo(TemplatePreviewDialog);
