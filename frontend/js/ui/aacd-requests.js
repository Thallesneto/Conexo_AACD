import { sessionUser, sessionKey } from '../auth-client.js';
import * as data from '../data.js';
import { activeSection, navigate } from '../router.js';
import { renderMatches } from './aacd-matches.js';

export function initAacdRequests({ onOrdersChanged, resetOrderFilters }) {
  const informationForm = document.getElementById('aacd-order-step-1')
  const specificationsForm = document.getElementById('aacd-order-step-2')
  const fileForm = document.getElementById('aacd-order-step-3')
  const forms = [informationForm, specificationsForm, fileForm]
  const matchList = document.getElementById('aacd-match-list')
  const openPanel = document.getElementById('aacd-open-requests')
  const openList = openPanel.querySelector('[data-open-requests]')
  const feedback = document.getElementById('aacd-connect-feedback')
  const recommendationFeedback = document.getElementById('aacd-recommendations-feedback')
  const reviewRequirements = document.getElementById('aacd-review-requirements')
  let matches = []
  let recommendationRequest = null
  let submission = null
  // Ignora uma resposta de recomendações se o formulário mudar durante a busca.
  let revision = 0

  function readDraft() {
    return {
      code: document.getElementById('aacd-order-code').value.trim(),
      priority: informationForm.querySelector('[name=priority]:checked').value,
      materials: [...specificationsForm.querySelectorAll('[name=materials]:checked')].map(
        (input) => input.value
      ),
      nozzles: [...specificationsForm.querySelectorAll('[name=nozzles]:checked')].map(
        (input) => input.value
      ),
      volumes: {
        X: Number(document.getElementById('aacd-volumeX').value),
        Y: Number(document.getElementById('aacd-volumeY').value),
        Z: Number(document.getElementById('aacd-volumeZ').value)
      },
      url: document.getElementById('aacd-order-url').value,
      notes: document.getElementById('aacd-order-notes').value
    };
  }
  function populateRequestForm(request) {
    document.getElementById('aacd-order-code').value = request.codigo;
    const priority = data.PRIORITY_LABELS[request.prioridade];
    informationForm
      .querySelectorAll('[name=priority]')
      .forEach((input) => (input.checked = input.value === priority));
    for (const axis of ['X', 'Y', 'Z'])
      document.getElementById('aacd-volume' + axis).value =
        request['capacidade_' + axis.toLowerCase()];
    specificationsForm
      .querySelectorAll('[name=materials]')
      .forEach(
        (input) => (input.checked = request.materials.includes(input.value))
      );
    specificationsForm
      .querySelectorAll('[name=nozzles]')
      .forEach(
        (input) =>
          (input.checked = request.nozzles.includes(Number(input.value)))
      );
    document.getElementById('aacd-order-url').value = request.link;
    document.getElementById('aacd-order-notes').value =
      request.observacoes || '';
  }
  function renderDemandSummary(draft) {
    document.getElementById('aacd-demand-code').textContent = draft.code;
    document.getElementById('aacd-demand-material').textContent =
      draft.materials.join(', ');
    document.querySelector('#aacd-demand-volume span').textContent =
      `${draft.volumes.X}×${draft.volumes.Y}×${draft.volumes.Z} mm`;
    document.querySelector('[data-demand-unit]').textContent =
      sessionUser?.unidade || '';
    document.querySelector('[data-demand-priority]').textContent =
      draft.priority;
  }

  function validateOrderInformation() {
    const input = document.getElementById('aacd-order-code');
    input.setCustomValidity(
      input.value.trim() ? '' : 'Informe o código do pedido.'
    );
    if (!informationForm.checkValidity()) {
      navigate('aacd-pedido-1');
      informationForm.reportValidity();
      return false;
    }
    return true;
  }

  function validateOrderSpecifications() {
    if (!specificationsForm.checkValidity()) {
      navigate('aacd-pedido-2');
      specificationsForm.reportValidity();
      return false;
    }
    const hasMaterials = specificationsForm.querySelector('[name=materials]:checked');
    const hasNozzles = specificationsForm.querySelector('[name=nozzles]:checked');
    if (!hasMaterials || !hasNozzles) {
      navigate('aacd-pedido-2');
      specificationsForm.querySelector('.form-error').textContent =
        'Selecione pelo menos um material e um diâmetro de bico aceito para o pedido.';
      return false;
    }
    return true;
  }

  function validateOrderFile() {
    const input = document.getElementById('aacd-order-url');
    let valid = false;
    try {
      valid = ['http:', 'https:'].includes(new URL(input.value).protocol);
    } catch {
      /* campo inválido */
    }
    input.setCustomValidity(
      valid ? '' : 'Informe um link válido para o arquivo, começando com http:// ou https://.'
    );
    if (!fileForm.checkValidity()) {
      navigate('aacd-pedido-3');
      fileForm.reportValidity();
      return false;
    }
    return true;
  }

  async function showRecommendations(draft, requestId) {
    const actor = sessionKey(),
      requestedRevision = revision;
    const records = await data.listMatches(requestId ? { requestId } : draft);
    if (actor !== sessionKey() || requestedRevision !== revision) return;
    matches = records;
    renderMatches(matches);
    renderDemandSummary(draft);
    feedback.setAttribute('role', 'status');
    feedback.textContent = matches.length
      ? ''
      : 'Nenhum parceiro compatível encontrado. Revise os materiais, os diâmetros de bico e as dimensões do pedido.';
    reviewRequirements.hidden = matches.length > 0;
    navigate('aacd-conectar');
  }
  async function resumeRequest(button) {
    button.disabled = true;
    const actor = sessionKey(),
      requestedRevision = ++revision;
    try {
      const request = await data.getRequest(button.dataset.resumeRequest);
      if (actor !== sessionKey() || requestedRevision !== revision) return;
      populateRequestForm(request);
      await showRecommendations(readDraft(), request.id);
    } catch (error) {
      document.getElementById('aacd-orders-feedback').textContent =
        error.message;
    } finally {
      button.disabled = false;
    }
  }
  function renderOpenRequest(request) {
    const row = document.createElement('article');
    const label = document.createElement('span');
    const button = document.createElement('button');
    const status =
      request.ultimo_status === 'recusado'
        ? 'Recusado; escolha outro parceiro'
        : 'Aguardando encaminhamento';
    label.textContent =
      (request.codigo || 'SOL-' + request.id) + ' — ' + status;
    button.type = 'button';
    button.className = 'btn-back';
    button.textContent = 'Selecionar parceiro';
    button.dataset.resumeRequest = request.id;
    row.append(label, button);
    return row;
  }
  async function refreshOpenRequests() {
    const actor = sessionKey();
    const requests = await data.listRequests();
    if (actor !== sessionKey()) return;
    const open = requests.filter(
      (request) =>
        !request.encerrada_em &&
        !['pendente', 'em_producao'].includes(request.ultimo_status)
    );
    openPanel.hidden = !open.length;
    openList.replaceChildren(...open.map(renderOpenRequest));
  }
  
  function submitOrderInformation(event) {
    event.preventDefault();
    if (activeSection !== 'aacd-pedido-1') return;
    if (!validateOrderInformation()) return;
    navigate('aacd-pedido-2');
  }

  function submitOrderSpecifications(event) {
    event.preventDefault();
    if (activeSection !== 'aacd-pedido-2') return;
    if (!validateOrderSpecifications()) return;
    navigate('aacd-pedido-3');
  }

  async function submitOrderFile(event) {
    event.preventDefault();
    if (activeSection !== 'aacd-pedido-3') return;
    if (recommendationRequest || submission) return;
    if (!validateOrderFile()) return;
    if (!validateOrderInformation()) return;
    if (!validateOrderSpecifications()) return;
    const button = fileForm.querySelector('[type=submit]');
    const operation = {};
    const actor = sessionKey();
    recommendationRequest = operation;
    button.disabled = true;
    button.textContent = 'Buscando parceiros…';
    fileForm.setAttribute('aria-busy', 'true');
    fileForm.querySelector('.form-error').textContent = '';
    recommendationFeedback.textContent = 'Buscando parceiros compatíveis. Aguarde.';
    try {
      await showRecommendations(readDraft());
    } catch (error) {
      if (actor === sessionKey() && recommendationRequest === operation) {
        fileForm.querySelector('.form-error').textContent =
          error.status && error.status < 500
            ? error.message
            : 'Não foi possível buscar parceiros compatíveis. Verifique sua conexão e tente novamente.';
      }
    } finally {
      if (recommendationRequest === operation) {
        recommendationRequest = null;
        button.disabled = false;
        button.textContent = 'Escolher parceiro';
        fileForm.removeAttribute('aria-busy');
        recommendationFeedback.textContent = '';
      }
    }
  }

  function toggleMatchDetails(button) {
    const detail = document.getElementById(
      button.getAttribute('aria-controls')
    );
    detail.hidden = !detail.hidden;
    button.setAttribute('aria-expanded', String(!detail.hidden));
    button.textContent = detail.hidden
      ? 'Ver Ficha Técnica'
      : 'Ocultar Ficha Técnica';
  }
  async function connectOrder(button) {
    if (activeSection !== 'aacd-conectar' || submission) return;
    if (!validateOrderInformation()) return
    if (!validateOrderSpecifications()) return
    if (!validateOrderFile()) return
    const draft = readDraft();
    const match = matches.find(
      (record) => record.id === button.dataset.connectOrder
    );
    if (!match) return;
    const actor = sessionKey();
    const operation = {};
    submission = operation;
    const sendButtons = [...matchList.querySelectorAll('[data-connect-order]')];
    sendButtons.forEach((sendButton) => { sendButton.disabled = true; });
    button.querySelector('[data-send-label]').textContent = 'Enviando pedido…';
    matchList.setAttribute('aria-busy', 'true');
    feedback.setAttribute('role', 'status');
    feedback.textContent = 'Enviando pedido ao parceiro. Aguarde.';
    try {
      await data.createOrder({
        ...draft,
        selection: {
          partnerId: match.partnerId,
          printerId: match.printerId,
          material: match.material,
          nozzle: match.nozzle
        }
      });
      if (actor !== sessionKey() || submission !== operation) return;
      resetOrderFilters();
      feedback.textContent = '';
      reviewRequirements.hidden = true;
      matches = [];
      renderMatches(matches);
      navigate('aacd-pedidos');
      const refreshed = await onOrdersChanged();
      if (actor !== sessionKey() || submission !== operation) return;
      document.getElementById('aacd-orders-feedback').textContent =
        `Pedido ${draft.code} enviado ao parceiro ${match.name}. Aguardando aceite. Acompanhe em Pedidos.` +
        (refreshed === false
          ? ' Não foi possível atualizar a lista. Recarregue a página para acompanhar o pedido.'
          : '');
    } catch (error) {
      if (actor === sessionKey() && submission === operation) {
        feedback.setAttribute('role', 'alert');
        feedback.textContent = error.status && error.status < 500
          ? error.message
          : error.status
            ? 'Não foi possível enviar o pedido. Tente novamente em instantes.'
            : 'Não foi possível confirmar o envio do pedido. Verifique sua conexão e consulte Pedidos antes de tentar novamente.';
      }
    } finally {
      if (submission === operation) {
        submission = null;
        sendButtons.forEach((sendButton) => { sendButton.disabled = false; });
        button.querySelector('[data-send-label]').textContent = 'Enviar pedido ao parceiro';
        matchList.removeAttribute('aria-busy');
      }
    }
  }
  function onDraftInput(event) {
    revision++;
    matches = [];
    reviewRequirements.hidden = true;
    if ('setCustomValidity' in event.target) event.target.setCustomValidity('');
    const error = event.currentTarget.querySelector('.form-error');
    if (error) error.textContent = '';
  }
  forms.forEach((form) => {
    form.addEventListener('input', onDraftInput);
  });
  informationForm.addEventListener('submit', submitOrderInformation);
  specificationsForm.addEventListener('submit', submitOrderSpecifications);
  fileForm.addEventListener('submit', submitOrderFile);
  openList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-resume-request]');
    if (button) resumeRequest(button);
  });
  matchList.addEventListener('click', (event) => {
    const detail = event.target.closest('[data-match-detail]');
    if (detail) {
      toggleMatchDetails(detail);
      return;
    }
    const button = event.target.closest('[data-connect-order]');
    if (button) connectOrder(button);
  });
  function clear() {
    revision++;
    recommendationRequest = null;
    submission = null;
    matches = [];
    renderMatches(matches);
    matchList.removeAttribute('aria-busy');
    reviewRequirements.hidden = true;
    recommendationFeedback.textContent = '';
    fileForm.removeAttribute('aria-busy');
    const fileButton = fileForm.querySelector('[type=submit]');
    fileButton.disabled = false;
    fileButton.textContent = 'Escolher parceiro';
    forms.forEach((form) => {
      form.reset();
      form
        .querySelectorAll('input')
        .forEach((input) => input.setCustomValidity(''));
      form
        .querySelectorAll('.form-error')
        .forEach((error) => (error.textContent = ''));
    });
    for (const selector of [
      '#aacd-demand-code',
      '#aacd-demand-material',
      '#aacd-demand-volume span',
      '[data-demand-unit]',
      '[data-demand-priority]'
    ]) {
      document.querySelector(selector).textContent = '';
    }
    openList.replaceChildren();
    openPanel.hidden = true;
    feedback.textContent = '';
  }
  return { refreshOpenRequests, clear };
}
