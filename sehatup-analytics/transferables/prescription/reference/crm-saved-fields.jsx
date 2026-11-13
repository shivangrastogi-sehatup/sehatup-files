const prescriptionData = {
        patientId: customer.id,
        numericPatientId,
        patientName,
        patientGender,
        patientAge,
        phone: customer.phone || '',
        reportCategory: customer.reportCategory || '',
        primaryDiagnosis,
        clinicalFindings,
        prescriptionTemplate: prescriptionTemplate || null,
        consultationDate,
        followUpDate: followUpDate || null,
        lifestyleChanges: (lifestyleAdvice || '').split('\n').filter(l => l.trim()).map(text => ({ text })),
        recommendedProducts: items.map(it => {
          let frequency;
          if (it.dosageType === 'drops') {
            frequency = `${it.dosageValue || '5'} Drops - ${it.dosageFrequency || '2'} Times a day`;
          } else if (it.dosageType === 'topical') {
            frequency = it.dosageValue || 'Apply as directed';
          } else {
            frequency = Array.isArray(it.dosage) ? it.dosage.join(' - ') : '';
          }
          return {
            ...it,
            frequency,
            duration: `${it.durationValue || 1} ${it.durationUnit || 'month'}${(it.durationValue || 1) > 1 ? 's' : ''}`,
            type: it.detailsHeader?.split('|')?.[0]?.trim() || 'TABLET',
            timing: it.detailsHeader?.split('|')?.[1]?.trim() || 'As directed',
            instruction: it.detailsSubtext || '',
            dosageType: it.dosageType || 'schedule',
          };
        }),
        submissionCollectionName: collectionName,
        doctorUid: auth?.currentUser?.uid || '',
        doctors: allDoctors,
        doctorSignatures: allDoctors.flatMap(dr => dr.signatures || []),
        timestamp: serverTimestamp(),
      };
